---
name: add-attachments
description: Add channel-agnostic attachment support to NanoClaw. Downloads files from any channel, validates MIME via magic bytes, classifies inline (images/PDFs/text) vs file, and feeds multimodal content blocks to the container agent.
---

# Add Attachments

This skill adds a complete, channel-agnostic attachment pipeline. Channels populate `msg.attachments` with download URLs and optional auth headers; the orchestrator downloads, MIME-validates, sanitizes filenames, persists to `groups/<folder>/attachments/`, and hands the container agent either inline multimodal content blocks (images, PDFs, text) or a file-path reference.

## Phase 1: Pre-flight

### Check if already applied

```bash
test -f src/attachments.ts && echo "Already applied" || echo "Not applied"
```

If already applied, skip to Phase 3 (Verify).

## Phase 2: Apply Code Changes

### Ensure the skills remote

```bash
git remote -v
```

If `skills` remote pointing to `https://github.com/businesslifers/nanoclaw.git` is missing, add it:

```bash
git remote add skills https://github.com/businesslifers/nanoclaw.git
```

### Merge the skill branch

```bash
git fetch skills skill/attachments
git merge skills/skill/attachments
```

If there are merge conflicts on `package-lock.json`:

```bash
git checkout --theirs package-lock.json
git add package-lock.json
git merge --continue
```

For any other conflict, read the conflicted file and reconcile both sides manually. In particular, `src/container-runner.ts` may conflict around `OneCLI` construction — the skill branch predates the `ONECLI_API_KEY` fix, so **keep the `ONECLI_API_KEY` argument from your main** and layer the `SavedAttachment` import + `attachments` field on top.

This adds:
- `src/attachments.ts` — download pipeline with magic-byte MIME detection, filename sanitization, 15MB/5-per-message limits, inline vs file classification
- `src/attachments.test.ts` — unit tests for detectMimeType / classifyMode / processAttachments
- `src/db.test.ts` — new tests covering the `attachments` column round-trip
- Attachment persistence in `src/db.ts` — `messages.attachments` TEXT column (JSON) and `registered_groups.allow_attachments` gate (auto-enabled for main)
- Multimodal content-block construction in `container/agent-runner/src/index.ts` — inline images (base64) / PDFs (base64 document blocks) / text files concatenated; other files referenced by path
- `Attachment` interface + `attachments?: Attachment[]` on `NewMessage` in `src/types.ts`
- `ATTACHMENT_MAX_SIZE` (15MB) and `ATTACHMENT_MAX_PER_MESSAGE` (5) in `src/config.ts`
- `src/container-runner.ts` wiring for `SavedAttachment[]` on `ContainerInput`
- Attachment hydration in `src/index.ts` message loop
- `scripts/cleanup-sessions.sh` — prunes old `attachments/` directories alongside sessions

### Enable attachments per group (opt-in)

Attachments are gated per registered group via the `allow_attachments` column. The main group is enabled automatically by the migration. To enable other groups, update their registration in SQLite:

```bash
sqlite3 store/messages.db "UPDATE registered_groups SET allow_attachments = 1 WHERE folder = '<group_folder>';"
```

### Validate code changes

```bash
npm run build
npx vitest run src/attachments.test.ts src/db.test.ts
```

Build must be clean and tests must pass before proceeding.

## Phase 3: Verify

### Rebuild container and restart

The agent-runner inside the container has changed, so rebuild the image:

```bash
./container/build.sh
npm run build
```

Linux:
```bash
systemctl --user restart nanoclaw
```

macOS:
```bash
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

### Test an inline attachment

1. From a channel that populates `msg.attachments` (e.g. WhatsApp with image vision wired, or Telegram), send the main group an image with a caption that triggers the agent.
2. Watch `groups/<main>/attachments/` — a `<uuid>-<filename>` file should appear.
3. Confirm the agent's response references the image content (not just the filename).

### Test a file attachment

Send a non-inline file (e.g. `.docx`, `.zip`). The agent should see a message like:

```
[File: report.docx at /workspace/group/attachments/<uuid>-report.docx]
```

and be able to read it from that path inside the container.

### Inspect the database

```bash
sqlite3 store/messages.db "SELECT id, attachments FROM messages WHERE attachments IS NOT NULL ORDER BY timestamp DESC LIMIT 3;"
```

Each row's `attachments` should be JSON listing the saved URLs / filenames.

## Troubleshooting

### Attachments silently dropped

- Confirm the group has `allow_attachments = 1` in `registered_groups` — otherwise the pipeline is skipped.
- Check logs for `Attachment download failed` or `exceeds 15MB limit`.

### MIME detection wrong

`src/attachments.ts` validates via magic bytes first, then falls back to extension. Add the signature to the `SIGNATURES` array rather than trusting the channel-reported MIME.

### Container can't read files

Files land under `groups/<folder>/attachments/` on the host, which maps to `/workspace/group/attachments/` inside the container. If paths differ, verify `resolveGroupFolderPath` and the container's `/workspace/group` mount.

## Removal

1. Delete `src/attachments.ts` and `src/attachments.test.ts`.
2. Revert `container/agent-runner/src/index.ts` multimodal content-block construction.
3. Drop `attachments` / `allow_attachments` handling from `src/db.ts` (and optionally migrate data away).
4. Remove `ATTACHMENT_MAX_SIZE` / `ATTACHMENT_MAX_PER_MESSAGE` from `src/config.ts`.
5. Remove `Attachment` / `NewMessage.attachments` from `src/types.ts`.
6. Remove `SavedAttachment` wiring from `src/container-runner.ts` and the call site in `src/index.ts`.
7. Rebuild: `./container/build.sh && npm run build && systemctl --user restart nanoclaw`.
