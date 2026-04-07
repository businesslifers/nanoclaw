import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

import makeWASocket, {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  WAMessageKey,
  WASocket,
  fetchLatestWaWebVersion,
  makeCacheableSignalKeyStore,
  normalizeMessageContent,
  proto,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';

import {
  ASSISTANT_HAS_OWN_NUMBER,
  ASSISTANT_NAME,
  GROUPS_DIR,
  STORE_DIR,
} from '../config.js';
import {
  getLastGroupSync,
  getLatestMessage,
  setLastGroupSync,
  storeReaction,
  updateChatName,
} from '../db.js';
import { processImage } from '../image.js';
import { logger } from '../logger.js';
import { isVoiceMessage, transcribeAudioMessage } from '../transcription.js';
import { registerChannel, ChannelOpts } from './registry.js';
import {
  Channel,
  OnInboundMessage,
  OnChatMetadata,
  RegisteredGroup,
} from '../types.js';

// Baileys expects a pino-compatible ILogger. Wrap the built-in logger
// with the extra properties Baileys needs (level, child, trace).
const baileysLogger = Object.assign({}, logger, {
  level: 'warn' as const,
  trace: logger.debug,
  child: () => baileysLogger,
});

const GROUP_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface WhatsAppChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
}

export class WhatsAppChannel implements Channel {
  name = 'whatsapp';

  private sock!: WASocket;
  private connected = false;
  private lidToPhoneMap: Record<string, string> = {};
  private outgoingQueue: Array<{ jid: string; text: string }> = [];
  private flushing = false;
  private groupSyncTimerStarted = false;
  /** Cache of recently sent messages for retry requests (max 256 entries). */
  private sentMessageCache = new Map<string, proto.IMessage>();
  /** Bot's LID user ID (e.g. "80355281346633") for normalizing group mentions. */
  private botLidUser?: string;
  /** Cache of group participants for mention resolution. Keyed by group JID. */
  private participantCache = new Map<
    string,
    { participants: Array<{ name: string; jid: string }>; fetchedAt: number }
  >();
  private static PARTICIPANT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
  /** Recent outbound message hashes for deduplication. Maps hash → timestamp. */
  private recentSentHashes = new Map<string, number>();
  private static DEDUP_WINDOW_MS = 30_000; // 30 seconds

  private opts: WhatsAppChannelOpts;

  constructor(opts: WhatsAppChannelOpts) {
    this.opts = opts;
  }

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.connectInternal(resolve).catch(reject);
    });
  }

  private async connectInternal(onFirstOpen?: () => void): Promise<void> {
    const authDir = path.join(STORE_DIR, 'auth');
    fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const { version } = await fetchLatestWaWebVersion({}).catch((err) => {
      logger.warn(
        { err },
        'Failed to fetch latest WA Web version, using default',
      );
      return { version: undefined };
    });
    this.sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
      },
      printQRInTerminal: false,
      logger: baileysLogger,
      browser: Browsers.macOS('Chrome'),
      getMessage: async (key: WAMessageKey) => {
        const cached = this.sentMessageCache.get(key.id || '');
        if (cached) {
          logger.debug(
            { id: key.id },
            'getMessage: returning cached message for retry',
          );
          return cached;
        }
        logger.debug({ id: key.id }, 'getMessage: no cached message found');
        return undefined;
      },
    });

    // Pre-seed from auth creds so offline messages received before
    // connection.open can have their LID mentions normalised to @AssistantName.
    this.setLidMapping(state.creds.me?.lid, state.creds.me?.id);

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const msg =
          'WhatsApp authentication required. Run /setup in Claude Code.';
        logger.error(msg);
        exec(
          `osascript -e 'display notification "${msg}" with title "NanoClaw" sound name "Basso"'`,
        );
        setTimeout(() => process.exit(1), 1000);
      }

      if (connection === 'close') {
        this.connected = false;
        const reason = (
          lastDisconnect?.error as { output?: { statusCode?: number } }
        )?.output?.statusCode;
        const shouldReconnect = reason !== DisconnectReason.loggedOut;
        logger.info(
          {
            reason,
            shouldReconnect,
            queuedMessages: this.outgoingQueue.length,
          },
          'Connection closed',
        );

        if (shouldReconnect) {
          this.scheduleReconnect(1);
        } else {
          logger.info('Logged out. Run /setup to re-authenticate.');
          process.exit(0);
        }
      } else if (connection === 'open') {
        this.connected = true;
        logger.info('Connected to WhatsApp');

        // Announce availability so WhatsApp relays subsequent presence updates (typing indicators)
        this.sock.sendPresenceUpdate('available').catch((err) => {
          logger.warn({ err }, 'Failed to send presence update');
        });

        // Refresh LID mapping from live socket state (may differ from cached creds)
        if (this.sock.user) {
          this.setLidMapping(this.sock.user.lid, this.sock.user.id);
        }

        // Flush any messages queued while disconnected
        this.flushOutgoingQueue().catch((err) =>
          logger.error({ err }, 'Failed to flush outgoing queue'),
        );

        // Sync group metadata on startup (respects 24h cache)
        this.syncGroupMetadata().catch((err) =>
          logger.error({ err }, 'Initial group sync failed'),
        );
        // Set up daily sync timer (only once)
        if (!this.groupSyncTimerStarted) {
          this.groupSyncTimerStarted = true;
          setInterval(() => {
            this.syncGroupMetadata().catch((err) =>
              logger.error({ err }, 'Periodic group sync failed'),
            );
          }, GROUP_SYNC_INTERVAL_MS);
        }

        // Signal first connection to caller
        if (onFirstOpen) {
          onFirstOpen();
          onFirstOpen = undefined;
        }
      }
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        try {
          if (!msg.message) continue;
          const rawJid = msg.key.remoteJid;
          if (!rawJid || rawJid === 'status@broadcast') continue;

          // Translate LID JID to phone JID if applicable.
          // Prefer senderPn from the message key (available in newer WA protocol)
          // since translateJid may fail to resolve LID→phone via signalRepository.
          let chatJid = await this.translateJid(rawJid);
          if (chatJid.endsWith('@lid') && (msg.key as any).senderPn) {
            const pn = (msg.key as any).senderPn as string;
            const phoneJid = pn.includes('@') ? pn : `${pn}@s.whatsapp.net`;
            this.lidToPhoneMap[rawJid.split('@')[0].split(':')[0]] = phoneJid;
            chatJid = phoneJid;
            logger.info(
              { lidJid: rawJid, phoneJid },
              'Translated LID via senderPn',
            );
          }

          const timestamp = new Date(
            Number(msg.messageTimestamp) * 1000,
          ).toISOString();

          // Always notify about chat metadata for group discovery
          const isGroup = chatJid.endsWith('@g.us');
          this.opts.onChatMetadata(
            chatJid,
            timestamp,
            undefined,
            'whatsapp',
            isGroup,
          );

          // Only deliver full message for registered groups
          const groups = this.opts.registeredGroups();
          if (groups[chatJid]) {
            const normalized =
              normalizeMessageContent(msg.message) || msg.message;
            let content =
              normalized?.conversation ||
              normalized?.extendedTextMessage?.text ||
              normalized?.imageMessage?.caption ||
              normalized?.videoMessage?.caption ||
              '';

            // Image attachment handling
            // Use normalized message (not raw msg) because Baileys may wrap
            // images in containers (ephemeral, viewOnce, etc.) that the raw
            // msg.message.imageMessage path won't find.
            if (normalized?.imageMessage) {
              const caption = normalized?.imageMessage?.caption ?? '';
              try {
                const buffer = await downloadMediaMessage(msg, 'buffer', {});
                const groupDir = path.join(GROUPS_DIR, groups[chatJid].folder);
                const result = await processImage(
                  buffer as Buffer,
                  groupDir,
                  caption,
                );
                if (result) {
                  content = result.content;
                }
              } catch (err) {
                logger.warn({ err, jid: chatJid }, 'Image - download failed');
              }
              // Ensure image messages are never silently dropped
              if (!content) {
                content = caption || '[Image: could not be downloaded]';
              }
            }

            // PDF attachment handling
            if (normalized?.documentMessage?.mimetype === 'application/pdf') {
              try {
                const buffer = await downloadMediaMessage(msg, 'buffer', {});
                const groupDir = path.join(GROUPS_DIR, groups[chatJid].folder);
                const attachDir = path.join(groupDir, 'attachments');
                fs.mkdirSync(attachDir, { recursive: true });
                const filename = path.basename(
                  normalized.documentMessage.fileName ||
                    `doc-${Date.now()}.pdf`,
                );
                const filePath = path.join(attachDir, filename);
                fs.writeFileSync(filePath, buffer as Buffer);
                const sizeKB = Math.round((buffer as Buffer).length / 1024);
                const pdfRef = `[PDF: attachments/${filename} (${sizeKB}KB)]\nUse: pdf-reader extract attachments/${filename}`;
                const caption = normalized.documentMessage.caption || '';
                content = caption ? `${caption}\n\n${pdfRef}` : pdfRef;
                logger.info(
                  { jid: chatJid, filename },
                  'Downloaded PDF attachment',
                );
              } catch (err) {
                logger.warn(
                  { err, jid: chatJid },
                  'Failed to download PDF attachment',
                );
              }
            }

            // WhatsApp group mentions use the LID in raw text (e.g. "@80355281346633")
            // instead of the display name. Normalize to @AssistantName for trigger matching.
            if (this.botLidUser && content.includes(`@${this.botLidUser}`)) {
              content = content.replace(
                `@${this.botLidUser}`,
                `@${ASSISTANT_NAME}`,
              );
            }

            // Skip protocol messages with no text content (encryption keys, read receipts, etc.)
            // but allow voice messages through for transcription
            if (!content && !isVoiceMessage(msg)) continue;

            let sender = msg.key.participant || msg.key.remoteJid || '';
            // Normalize LID senders to phone JID so downstream code
            // (allowlist, trigger checks) can match on phone numbers only.
            if (sender.endsWith('@lid')) {
              const lidUser = sender.split('@')[0].split(':')[0];
              const phoneSender = this.lidToPhoneMap[lidUser];
              if (phoneSender) {
                sender = phoneSender;
              }
            }
            const senderName = msg.pushName || sender.split('@')[0];

            const fromMe = msg.key.fromMe || false;
            // Detect bot messages: with own number, fromMe is reliable
            // since only the bot sends from that number.
            // With shared number, bot messages carry the assistant name prefix
            // (even in DMs/self-chat) so we check for that.
            const isBotMessage = ASSISTANT_HAS_OWN_NUMBER
              ? fromMe
              : content.startsWith(`${ASSISTANT_NAME}:`);

            // Drop messages sent by OTHER linked devices on the bot's WhatsApp
            // account. NanoClaw sends via sock.sendMessage which caches the
            // message ID. If fromMe=true but the ID isn't in our sent cache,
            // the message came from another device (stale WhatsApp Web session,
            // another Baileys instance, etc.) and should be ignored to prevent
            // duplicate replies.
            if (
              ASSISTANT_HAS_OWN_NUMBER &&
              fromMe &&
              !this.sentMessageCache.has(msg.key.id || '')
            ) {
              logger.warn(
                { id: msg.key.id, remoteJid: rawJid },
                'Dropping fromMe message not sent by this instance (likely another linked device)',
              );
              continue;
            }

            // Extract quoted message context (reply-to)
            const contextInfo =
              normalized?.extendedTextMessage?.contextInfo ||
              normalized?.imageMessage?.contextInfo ||
              normalized?.videoMessage?.contextInfo ||
              normalized?.documentMessage?.contextInfo ||
              normalized?.audioMessage?.contextInfo ||
              null;

            let replyToMessageId: string | undefined;
            let replyToContent: string | undefined;
            let replyToSenderName: string | undefined;

            // Set reply ID whenever stanzaId is present, even without
            // a quoted payload (the router can render reply_to alone).
            if (contextInfo?.stanzaId) {
              replyToMessageId = contextInfo.stanzaId;
            }

            if (contextInfo?.stanzaId && contextInfo?.quotedMessage) {
              const quotedNorm =
                normalizeMessageContent(contextInfo.quotedMessage) ||
                contextInfo.quotedMessage;
              replyToContent =
                quotedNorm?.conversation ||
                quotedNorm?.extendedTextMessage?.text ||
                quotedNorm?.imageMessage?.caption ||
                quotedNorm?.videoMessage?.caption ||
                '';
              // Resolve sender name for the quoted message.
              // In groups, participant identifies who sent the quoted msg.
              // In DMs, participant is empty — fall back to the chat JID
              // (the other party) so the router can still emit <quoted_message>.
              const quotedParticipant =
                contextInfo.participant || chatJid || '';
              if (quotedParticipant) {
                let resolvedParticipant = quotedParticipant;
                if (resolvedParticipant.endsWith('@lid')) {
                  const lidUser = resolvedParticipant
                    .split('@')[0]
                    .split(':')[0];
                  resolvedParticipant =
                    this.lidToPhoneMap[lidUser] || resolvedParticipant;
                }
                replyToSenderName = resolvedParticipant.split('@')[0];
              }
            }

            // Transcribe voice messages before delivering
            let finalContent = content;
            if (isVoiceMessage(msg)) {
              try {
                const transcript = await transcribeAudioMessage(msg, this.sock);
                if (transcript) {
                  finalContent = `[Voice: ${transcript}]`;
                  logger.info(
                    { chatJid, length: transcript.length },
                    'Transcribed voice message',
                  );
                } else {
                  finalContent = '[Voice Message - transcription unavailable]';
                }
              } catch (err) {
                logger.error({ err }, 'Voice transcription error');
                finalContent = '[Voice Message - transcription failed]';
              }
            }

            this.opts.onMessage(chatJid, {
              id: msg.key.id || '',
              chat_jid: chatJid,
              sender,
              sender_name: senderName,
              content: finalContent,
              timestamp,
              is_from_me: fromMe,
              is_bot_message: isBotMessage,
              reply_to_message_id: replyToMessageId,
              reply_to_message_content: replyToContent,
              reply_to_sender_name: replyToSenderName,
            });
          } else if (chatJid !== rawJid) {
            // LID translation produced a JID that doesn't match any registered group
            logger.warn(
              {
                rawJid,
                translatedJid: chatJid,
                registeredJids: Object.keys(groups),
              },
              'Message JID not found in registered groups after translation',
            );
          }
        } catch (err) {
          logger.error(
            { err, remoteJid: msg.key?.remoteJid },
            'Error processing incoming message',
          );
        }
      }
    });

    // Listen for message reactions
    this.sock.ev.on('messages.reaction', async (reactions) => {
      for (const { key, reaction } of reactions) {
        try {
          const messageId = key.id;
          if (!messageId) continue;
          const rawChatJid = key.remoteJid;
          if (!rawChatJid || rawChatJid === 'status@broadcast') continue;
          const chatJid = await this.translateJid(rawChatJid);
          const groups = this.opts.registeredGroups();
          if (!groups[chatJid]) continue;
          const reactorJid =
            reaction.key?.participant || reaction.key?.remoteJid || '';
          const emoji = reaction.text || '';
          const timestamp = reaction.senderTimestampMs
            ? new Date(Number(reaction.senderTimestampMs)).toISOString()
            : new Date().toISOString();
          storeReaction({
            message_id: messageId,
            message_chat_jid: chatJid,
            reactor_jid: reactorJid,
            reactor_name: reactorJid.split('@')[0],
            emoji,
            timestamp,
          });
          logger.info(
            {
              chatJid,
              messageId: messageId.slice(0, 10) + '...',
              reactor: reactorJid.split('@')[0],
              emoji: emoji || '(removed)',
            },
            emoji ? 'Reaction added' : 'Reaction removed',
          );
        } catch (err) {
          logger.error({ err }, 'Failed to process reaction');
        }
      }
    });
  }

  private async resolveGroupParticipants(
    groupJid: string,
  ): Promise<Array<{ name: string; jid: string }>> {
    const cached = this.participantCache.get(groupJid);
    if (
      cached &&
      Date.now() - cached.fetchedAt < WhatsAppChannel.PARTICIPANT_CACHE_TTL_MS
    ) {
      return cached.participants;
    }

    try {
      const metadata = await this.sock.groupMetadata(groupJid);
      const participants: Array<{ name: string; jid: string }> = [];

      for (const p of metadata.participants) {
        const jid = p.id;
        if (p.notify) participants.push({ name: p.notify.toLowerCase(), jid });
        if (p.name) participants.push({ name: p.name.toLowerCase(), jid });
        const phone = (p.phoneNumber || p.id).split('@')[0];
        if (phone) participants.push({ name: phone, jid });
      }

      this.participantCache.set(groupJid, {
        participants,
        fetchedAt: Date.now(),
      });
      return participants;
    } catch (err) {
      logger.warn(
        { err, groupJid },
        'Failed to fetch group metadata for mentions',
      );
      return cached?.participants ?? [];
    }
  }

  private async extractMentions(
    text: string,
    groupJid: string,
  ): Promise<{ text: string; mentions: string[] }> {
    if (!text.includes('@')) return { text, mentions: [] };
    if (!groupJid.endsWith('@g.us')) return { text, mentions: [] };

    const participants = await this.resolveGroupParticipants(groupJid);
    if (participants.length === 0) return { text, mentions: [] };

    const mentionPattern = /@([A-Za-z0-9][\w\s\-'.]*?)(?=[\s,.:;!?)}\]@]|$)/g;
    const mentions = new Set<string>();
    // Collect replacements to apply after regex scanning (avoids offset issues)
    const replacements: Array<{ from: string; to: string }> = [];

    let match: RegExpExecArray | null;
    while ((match = mentionPattern.exec(text)) !== null) {
      const mentionName = match[1].trim().toLowerCase();
      if (!mentionName) continue;

      const found =
        participants.find((p) => p.name === mentionName) ||
        participants.find((p) => p.name.startsWith(mentionName));
      if (found) {
        mentions.add(found.jid);
        // WhatsApp renders mentions by matching @<user_id> in text against
        // the mentions JID array. Replace @DisplayName with @<user_id>.
        const userId = found.jid.split('@')[0];
        replacements.push({ from: match[0], to: `@${userId}` });
      }
    }

    let modified = text;
    for (const { from, to } of replacements) {
      modified = modified.replace(from, to);
    }

    return { text: modified, mentions: [...mentions] };
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    // Prefix bot messages with assistant name so users know who's speaking.
    // On a shared number, prefix is also needed in DMs (including self-chat)
    // to distinguish bot output from user messages.
    // Skip only when the assistant has its own dedicated phone number.
    const prefixed = ASSISTANT_HAS_OWN_NUMBER
      ? text
      : `${ASSISTANT_NAME}: ${text}`;

    // Dedup: skip if the same jid+text was sent in the last 30s.
    // Catches sub-agents and lead agent both sending the same content.
    const dedupKey = `${jid}:${prefixed}`;
    const now = Date.now();
    const lastSent = this.recentSentHashes.get(dedupKey);
    if (lastSent && now - lastSent < WhatsAppChannel.DEDUP_WINDOW_MS) {
      logger.info(
        { jid, length: prefixed.length },
        'Duplicate message suppressed (sent <30s ago)',
      );
      return;
    }
    this.recentSentHashes.set(dedupKey, now);
    // Prune old entries
    if (this.recentSentHashes.size > 100) {
      for (const [key, ts] of this.recentSentHashes) {
        if (now - ts > WhatsAppChannel.DEDUP_WINDOW_MS) {
          this.recentSentHashes.delete(key);
        }
      }
    }

    if (!this.connected) {
      this.outgoingQueue.push({ jid, text: prefixed });
      logger.info(
        { jid, length: prefixed.length, queueSize: this.outgoingQueue.length },
        'WA disconnected, message queued',
      );
      return;
    }
    try {
      const extracted = await this.extractMentions(prefixed, jid);
      const sent = await this.sock.sendMessage(jid, {
        text: extracted.text,
        ...(extracted.mentions.length > 0 && { mentions: extracted.mentions }),
      });
      // Cache for retry requests (recipient may ask us to re-encrypt)
      if (sent?.key?.id && sent.message) {
        this.sentMessageCache.set(sent.key.id, sent.message);
        if (this.sentMessageCache.size > 256) {
          const oldest = this.sentMessageCache.keys().next().value!;
          this.sentMessageCache.delete(oldest);
        }
      }
      logger.info({ jid, length: prefixed.length }, 'Message sent');
    } catch (err) {
      // If send fails, queue it for retry on reconnect
      this.outgoingQueue.push({ jid, text: prefixed });
      logger.warn(
        { jid, err, queueSize: this.outgoingQueue.length },
        'Failed to send, message queued',
      );
    }
  }

  async sendReaction(
    chatJid: string,
    messageKey: {
      id: string;
      remoteJid: string;
      fromMe?: boolean;
      participant?: string;
    },
    emoji: string,
  ): Promise<void> {
    if (!this.connected) {
      logger.warn({ chatJid, emoji }, 'Cannot send reaction - not connected');
      throw new Error('Not connected to WhatsApp');
    }
    try {
      await this.sock.sendMessage(chatJid, {
        react: { text: emoji, key: messageKey },
      });
      logger.info(
        {
          chatJid,
          messageId: messageKey.id?.slice(0, 10) + '...',
          emoji: emoji || '(removed)',
        },
        emoji ? 'Reaction sent' : 'Reaction removed',
      );
    } catch (err) {
      logger.error({ chatJid, emoji, err }, 'Failed to send reaction');
      throw err;
    }
  }

  async reactToLatestMessage(chatJid: string, emoji: string): Promise<void> {
    const latest = getLatestMessage(chatJid);
    if (!latest) {
      throw new Error(`No messages found for chat ${chatJid}`);
    }
    const messageKey = {
      id: latest.id,
      remoteJid: chatJid,
      fromMe: latest.fromMe,
    };
    await this.sendReaction(chatJid, messageKey, emoji);
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.endsWith('@g.us') || jid.endsWith('@s.whatsapp.net');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.sock?.end(undefined);
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    try {
      const status = isTyping ? 'composing' : 'paused';
      logger.debug({ jid, status }, 'Sending presence update');
      await this.sock.sendPresenceUpdate(status, jid);
    } catch (err) {
      logger.debug({ jid, err }, 'Failed to update typing status');
    }
  }

  /** Public wrapper for IPC refresh_groups. */
  async syncGroups(force = false): Promise<void> {
    return this.syncGroupMetadata(force);
  }

  /**
   * Sync group metadata from WhatsApp.
   * Fetches all participating groups and stores their names in the database.
   * Called on startup, daily, and on-demand via IPC.
   */
  private async syncGroupMetadata(force = false): Promise<void> {
    if (!force) {
      const lastSync = getLastGroupSync();
      if (lastSync) {
        const lastSyncTime = new Date(lastSync).getTime();
        if (Date.now() - lastSyncTime < GROUP_SYNC_INTERVAL_MS) {
          logger.debug({ lastSync }, 'Skipping group sync - synced recently');
          return;
        }
      }
    }

    try {
      logger.info('Syncing group metadata from WhatsApp...');
      const groups = await this.sock.groupFetchAllParticipating();

      let count = 0;
      for (const [jid, metadata] of Object.entries(groups)) {
        if (metadata.subject) {
          updateChatName(jid, metadata.subject);
          count++;
        }
      }

      setLastGroupSync();
      logger.info({ count }, 'Group metadata synced');
    } catch (err) {
      logger.error({ err }, 'Failed to sync group metadata');
    }
  }

  /** Extract LID user and phone user, then populate botLidUser + lidToPhoneMap. */
  private setLidMapping(
    lidRaw: string | undefined,
    phoneIdRaw: string | undefined,
  ): void {
    const lidUser = lidRaw?.split(':')[0];
    if (!lidUser) return;
    this.botLidUser = lidUser;
    const phoneUser = phoneIdRaw?.split(':')[0];
    if (phoneUser) {
      this.lidToPhoneMap[lidUser] = `${phoneUser}@s.whatsapp.net`;
    }
  }

  private scheduleReconnect(attempt: number): void {
    const delayMs = Math.min(5000 * Math.pow(2, attempt - 1), 300000);
    logger.info({ attempt, delayMs }, 'Reconnecting...');
    setTimeout(() => {
      this.connectInternal().catch((err) => {
        logger.error({ err, attempt }, 'Reconnection attempt failed');
        this.scheduleReconnect(attempt + 1);
      });
    }, delayMs);
  }

  private async translateJid(jid: string): Promise<string> {
    if (!jid.endsWith('@lid')) return jid;
    const lidUser = jid.split('@')[0].split(':')[0];

    // Check local cache first
    const cached = this.lidToPhoneMap[lidUser];
    if (cached) {
      logger.debug(
        { lidJid: jid, phoneJid: cached },
        'Translated LID to phone JID (cached)',
      );
      return cached;
    }

    // Query Baileys' signal repository for the mapping
    try {
      const pn = await (
        this.sock.signalRepository as any
      )?.lidMapping?.getPNForLID(jid);
      if (pn) {
        const phoneJid = `${pn.split('@')[0].split(':')[0]}@s.whatsapp.net`;
        this.lidToPhoneMap[lidUser] = phoneJid;
        logger.info(
          { lidJid: jid, phoneJid },
          'Translated LID to phone JID (signalRepository)',
        );
        return phoneJid;
      }
    } catch (err) {
      logger.debug({ err, jid }, 'Failed to resolve LID via signalRepository');
    }

    return jid;
  }

  private async flushOutgoingQueue(): Promise<void> {
    if (this.flushing || this.outgoingQueue.length === 0) return;
    this.flushing = true;
    try {
      logger.info(
        { count: this.outgoingQueue.length },
        'Flushing outgoing message queue',
      );
      while (this.outgoingQueue.length > 0) {
        const item = this.outgoingQueue.shift()!;
        // Send directly — queued items are already prefixed by sendMessage
        const extracted = await this.extractMentions(item.text, item.jid);
        const sent = await this.sock.sendMessage(item.jid, {
          text: extracted.text,
          ...(extracted.mentions.length > 0 && {
            mentions: extracted.mentions,
          }),
        });
        if (sent?.key?.id && sent.message) {
          this.sentMessageCache.set(sent.key.id, sent.message);
        }
        logger.info(
          { jid: item.jid, length: item.text.length },
          'Queued message sent',
        );
      }
    } finally {
      this.flushing = false;
    }
  }
}

registerChannel('whatsapp', (opts: ChannelOpts) => new WhatsAppChannel(opts));
