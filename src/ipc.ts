import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

import { CronExpressionParser } from 'cron-parser';

import { DATA_DIR, IPC_POLL_INTERVAL, TIMEZONE } from './config.js';
import { AvailableGroup } from './container-runner.js';
import {
  createRequest,
  createTask,
  deleteRegisteredGroup,
  deleteSession,
  deleteTask,
  getAllRegisteredGroups,
  getRegisteredGroup,
  getRequestById,
  getTaskById,
  resolveRequest,
  updateTask,
} from './db.js';
import { isValidGroupFolder } from './group-folder.js';
import { logger } from './logger.js';
import { RegisteredGroup } from './types.js';

export interface IpcDeps {
  sendMessage: (jid: string, text: string) => Promise<void>;
  registeredGroups: () => Record<string, RegisteredGroup>;
  registerGroup: (jid: string, group: RegisteredGroup) => void;
  syncGroups: (force: boolean) => Promise<void>;
  getAvailableGroups: () => AvailableGroup[];
  writeGroupsSnapshot: (
    groupFolder: string,
    isMain: boolean,
    availableGroups: AvailableGroup[],
    registeredJids: Set<string>,
  ) => void;
  onTasksChanged: () => void;
}

let ipcWatcherRunning = false;

export function startIpcWatcher(deps: IpcDeps): void {
  if (ipcWatcherRunning) {
    logger.debug('IPC watcher already running, skipping duplicate start');
    return;
  }
  ipcWatcherRunning = true;

  const ipcBaseDir = path.join(DATA_DIR, 'ipc');
  fs.mkdirSync(ipcBaseDir, { recursive: true });

  const processIpcFiles = async () => {
    // Scan all group IPC directories (identity determined by directory)
    let groupFolders: string[];
    try {
      groupFolders = fs.readdirSync(ipcBaseDir).filter((f) => {
        const stat = fs.statSync(path.join(ipcBaseDir, f));
        return stat.isDirectory() && f !== 'errors';
      });
    } catch (err) {
      logger.error({ err }, 'Error reading IPC base directory');
      setTimeout(processIpcFiles, IPC_POLL_INTERVAL);
      return;
    }

    const registeredGroups = deps.registeredGroups();

    // Build folder→isMain lookup from registered groups
    const folderIsMain = new Map<string, boolean>();
    for (const group of Object.values(registeredGroups)) {
      if (group.isMain) folderIsMain.set(group.folder, true);
    }

    for (const sourceGroup of groupFolders) {
      const isMain = folderIsMain.get(sourceGroup) === true;
      const messagesDir = path.join(ipcBaseDir, sourceGroup, 'messages');
      const tasksDir = path.join(ipcBaseDir, sourceGroup, 'tasks');

      // Process messages from this group's IPC directory
      try {
        if (fs.existsSync(messagesDir)) {
          const messageFiles = fs
            .readdirSync(messagesDir)
            .filter((f) => f.endsWith('.json'));
          for (const file of messageFiles) {
            const filePath = path.join(messagesDir, file);
            try {
              const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
              if (data.type === 'message' && data.chatJid && data.text) {
                // Authorization: verify this group can send to this chatJid
                const targetGroup = registeredGroups[data.chatJid];
                if (
                  isMain ||
                  (targetGroup && targetGroup.folder === sourceGroup)
                ) {
                  await deps.sendMessage(data.chatJid, data.text);
                  logger.info(
                    { chatJid: data.chatJid, sourceGroup },
                    'IPC message sent',
                  );
                } else {
                  logger.warn(
                    { chatJid: data.chatJid, sourceGroup },
                    'Unauthorized IPC message attempt blocked',
                  );
                }
              }
              fs.unlinkSync(filePath);
            } catch (err) {
              logger.error(
                { file, sourceGroup, err },
                'Error processing IPC message',
              );
              const errorDir = path.join(ipcBaseDir, 'errors');
              fs.mkdirSync(errorDir, { recursive: true });
              fs.renameSync(
                filePath,
                path.join(errorDir, `${sourceGroup}-${file}`),
              );
            }
          }
        }
      } catch (err) {
        logger.error(
          { err, sourceGroup },
          'Error reading IPC messages directory',
        );
      }

      // Process tasks from this group's IPC directory
      try {
        if (fs.existsSync(tasksDir)) {
          const taskFiles = fs
            .readdirSync(tasksDir)
            .filter((f) => f.endsWith('.json'));
          for (const file of taskFiles) {
            const filePath = path.join(tasksDir, file);
            try {
              const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
              // Pass source group identity to processTaskIpc for authorization
              await processTaskIpc(data, sourceGroup, isMain, deps);
              fs.unlinkSync(filePath);
            } catch (err) {
              logger.error(
                { file, sourceGroup, err },
                'Error processing IPC task',
              );
              const errorDir = path.join(ipcBaseDir, 'errors');
              fs.mkdirSync(errorDir, { recursive: true });
              fs.renameSync(
                filePath,
                path.join(errorDir, `${sourceGroup}-${file}`),
              );
            }
          }
        }
      } catch (err) {
        logger.error({ err, sourceGroup }, 'Error reading IPC tasks directory');
      }
    }

    setTimeout(processIpcFiles, IPC_POLL_INTERVAL);
  };

  processIpcFiles();
  logger.info('IPC watcher started (per-group namespaces)');
}

/** Alphanumeric, hyphens, underscores, dots — no path traversal characters. */
const SAFE_ID_RE = /^[\w.-]+$/;

function writeIpcResponse(
  sourceGroup: string,
  requestId: string,
  response: object,
): void {
  if (!SAFE_ID_RE.test(requestId)) {
    logger.warn({ requestId, sourceGroup }, 'Invalid requestId rejected');
    return;
  }
  const inputDir = path.join(DATA_DIR, 'ipc', sourceGroup, 'input');
  fs.mkdirSync(inputDir, { recursive: true });
  const filePath = path.join(inputDir, `${requestId}.json`);
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(response, null, 2));
  fs.renameSync(tempPath, filePath);
}

function execOneCLI(
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile('onecli', args, { timeout: 15_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${err.message}\n${stderr}`));
      else resolve({ stdout, stderr });
    });
  });
}

export async function processTaskIpc(
  data: {
    type: string;
    taskId?: string;
    prompt?: string;
    schedule_type?: string;
    schedule_value?: string;
    context_mode?: string;
    script?: string;
    groupFolder?: string;
    chatJid?: string;
    targetJid?: string;
    // For register_group
    jid?: string;
    name?: string;
    folder?: string;
    trigger?: string;
    requiresTrigger?: boolean;
    containerConfig?: RegisteredGroup['containerConfig'];
    // For admin commands
    requestId?: string;
    agentIdentifier?: string;
    secretId?: string;
    secretType?: string;
    value?: string;
    hostPattern?: string;
    headerName?: string;
    valueFormat?: string;
    pathPattern?: string;
    secretIds?: string[];
  },
  sourceGroup: string, // Verified identity from IPC directory
  isMain: boolean, // Verified from directory path
  deps: IpcDeps,
): Promise<void> {
  const registeredGroups = deps.registeredGroups();

  switch (data.type) {
    case 'schedule_task':
      if (
        data.prompt &&
        data.schedule_type &&
        data.schedule_value &&
        data.targetJid
      ) {
        // Resolve the target group from JID
        const targetJid = data.targetJid as string;
        const targetGroupEntry = registeredGroups[targetJid];

        if (!targetGroupEntry) {
          logger.warn(
            { targetJid },
            'Cannot schedule task: target group not registered',
          );
          break;
        }

        const targetFolder = targetGroupEntry.folder;

        // Authorization: non-main groups can only schedule for themselves
        if (!isMain && targetFolder !== sourceGroup) {
          logger.warn(
            { sourceGroup, targetFolder },
            'Unauthorized schedule_task attempt blocked',
          );
          break;
        }

        const scheduleType = data.schedule_type as 'cron' | 'interval' | 'once';

        let nextRun: string | null = null;
        if (scheduleType === 'cron') {
          try {
            const interval = CronExpressionParser.parse(data.schedule_value, {
              tz: TIMEZONE,
            });
            nextRun = interval.next().toISOString();
          } catch {
            logger.warn(
              { scheduleValue: data.schedule_value },
              'Invalid cron expression',
            );
            break;
          }
        } else if (scheduleType === 'interval') {
          const ms = parseInt(data.schedule_value, 10);
          if (isNaN(ms) || ms <= 0) {
            logger.warn(
              { scheduleValue: data.schedule_value },
              'Invalid interval',
            );
            break;
          }
          nextRun = new Date(Date.now() + ms).toISOString();
        } else if (scheduleType === 'once') {
          const date = new Date(data.schedule_value);
          if (isNaN(date.getTime())) {
            logger.warn(
              { scheduleValue: data.schedule_value },
              'Invalid timestamp',
            );
            break;
          }
          nextRun = date.toISOString();
        }

        const taskId =
          data.taskId ||
          `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const contextMode =
          data.context_mode === 'group' || data.context_mode === 'isolated'
            ? data.context_mode
            : 'isolated';
        createTask({
          id: taskId,
          group_folder: targetFolder,
          chat_jid: targetJid,
          prompt: data.prompt,
          script: data.script || null,
          schedule_type: scheduleType,
          schedule_value: data.schedule_value,
          context_mode: contextMode,
          next_run: nextRun,
          status: 'active',
          created_at: new Date().toISOString(),
        });
        logger.info(
          { taskId, sourceGroup, targetFolder, contextMode },
          'Task created via IPC',
        );
        deps.onTasksChanged();
      }
      break;

    case 'pause_task':
      if (data.taskId) {
        const task = getTaskById(data.taskId);
        if (task && (isMain || task.group_folder === sourceGroup)) {
          updateTask(data.taskId, { status: 'paused' });
          logger.info(
            { taskId: data.taskId, sourceGroup },
            'Task paused via IPC',
          );
          deps.onTasksChanged();
        } else {
          logger.warn(
            { taskId: data.taskId, sourceGroup },
            'Unauthorized task pause attempt',
          );
        }
      }
      break;

    case 'resume_task':
      if (data.taskId) {
        const task = getTaskById(data.taskId);
        if (task && (isMain || task.group_folder === sourceGroup)) {
          updateTask(data.taskId, { status: 'active' });
          logger.info(
            { taskId: data.taskId, sourceGroup },
            'Task resumed via IPC',
          );
          deps.onTasksChanged();
        } else {
          logger.warn(
            { taskId: data.taskId, sourceGroup },
            'Unauthorized task resume attempt',
          );
        }
      }
      break;

    case 'cancel_task':
      if (data.taskId) {
        const task = getTaskById(data.taskId);
        if (task && (isMain || task.group_folder === sourceGroup)) {
          deleteTask(data.taskId);
          logger.info(
            { taskId: data.taskId, sourceGroup },
            'Task cancelled via IPC',
          );
          deps.onTasksChanged();
        } else {
          logger.warn(
            { taskId: data.taskId, sourceGroup },
            'Unauthorized task cancel attempt',
          );
        }
      }
      break;

    case 'update_task':
      if (data.taskId) {
        const task = getTaskById(data.taskId);
        if (!task) {
          logger.warn(
            { taskId: data.taskId, sourceGroup },
            'Task not found for update',
          );
          break;
        }
        if (!isMain && task.group_folder !== sourceGroup) {
          logger.warn(
            { taskId: data.taskId, sourceGroup },
            'Unauthorized task update attempt',
          );
          break;
        }

        const updates: Parameters<typeof updateTask>[1] = {};
        if (data.prompt !== undefined) updates.prompt = data.prompt;
        if (data.script !== undefined) updates.script = data.script || null;
        if (data.schedule_type !== undefined)
          updates.schedule_type = data.schedule_type as
            | 'cron'
            | 'interval'
            | 'once';
        if (data.schedule_value !== undefined)
          updates.schedule_value = data.schedule_value;

        // Recompute next_run if schedule changed
        if (data.schedule_type || data.schedule_value) {
          const updatedTask = {
            ...task,
            ...updates,
          };
          if (updatedTask.schedule_type === 'cron') {
            try {
              const interval = CronExpressionParser.parse(
                updatedTask.schedule_value,
                { tz: TIMEZONE },
              );
              updates.next_run = interval.next().toISOString();
            } catch {
              logger.warn(
                { taskId: data.taskId, value: updatedTask.schedule_value },
                'Invalid cron in task update',
              );
              break;
            }
          } else if (updatedTask.schedule_type === 'interval') {
            const ms = parseInt(updatedTask.schedule_value, 10);
            if (!isNaN(ms) && ms > 0) {
              updates.next_run = new Date(Date.now() + ms).toISOString();
            }
          }
        }

        updateTask(data.taskId, updates);
        logger.info(
          { taskId: data.taskId, sourceGroup, updates },
          'Task updated via IPC',
        );
        deps.onTasksChanged();
      }
      break;

    case 'refresh_groups':
      // Only main group can request a refresh
      if (isMain) {
        logger.info(
          { sourceGroup },
          'Group metadata refresh requested via IPC',
        );
        await deps.syncGroups(true);
        // Write updated snapshot immediately
        const availableGroups = deps.getAvailableGroups();
        deps.writeGroupsSnapshot(
          sourceGroup,
          true,
          availableGroups,
          new Set(Object.keys(registeredGroups)),
        );
      } else {
        logger.warn(
          { sourceGroup },
          'Unauthorized refresh_groups attempt blocked',
        );
      }
      break;

    case 'register_group':
      // Only main group can register new groups
      if (!isMain) {
        logger.warn(
          { sourceGroup },
          'Unauthorized register_group attempt blocked',
        );
        break;
      }
      if (data.jid && data.name && data.folder && data.trigger) {
        if (!isValidGroupFolder(data.folder)) {
          logger.warn(
            { sourceGroup, folder: data.folder },
            'Invalid register_group request - unsafe folder name',
          );
          break;
        }
        // Defense in depth: agent cannot set isMain via IPC.
        // Preserve isMain from the existing registration so IPC config
        // updates (e.g. adding additionalMounts) don't strip the flag.
        const existingGroup = registeredGroups[data.jid];
        deps.registerGroup(data.jid, {
          name: data.name,
          folder: data.folder,
          trigger: data.trigger,
          added_at: new Date().toISOString(),
          containerConfig: data.containerConfig,
          requiresTrigger: data.requiresTrigger,
          isMain: existingGroup?.isMain,
        });
      } else {
        logger.warn(
          { data },
          'Invalid register_group request - missing required fields',
        );
      }
      break;

    // --- Admin commands (main-only) ---

    case 'admin_update_container_config': {
      if (!isMain) {
        logger.warn(
          { sourceGroup },
          'Unauthorized admin_update_container_config blocked',
        );
        break;
      }
      if (!data.jid || !data.containerConfig) {
        logger.warn(
          { sourceGroup },
          'admin_update_container_config missing jid or containerConfig',
        );
        break;
      }
      const targetGroup = registeredGroups[data.jid];
      if (!targetGroup) {
        logger.warn(
          { jid: data.jid },
          'admin_update_container_config: group not found',
        );
        break;
      }
      const updatedGroup: RegisteredGroup = {
        ...targetGroup,
        containerConfig: data.containerConfig,
      };
      deps.registerGroup(data.jid, updatedGroup);
      logger.info(
        { jid: data.jid, sourceGroup },
        'Container config updated via admin IPC',
      );
      break;
    }

    case 'admin_onecli_list_secrets': {
      if (!isMain) {
        logger.warn(
          { sourceGroup },
          'Unauthorized admin_onecli_list_secrets blocked',
        );
        break;
      }
      if (!data.requestId) break;
      try {
        const { stdout } = await execOneCLI([
          'secrets',
          'list',
          '--quiet',
          '--fields',
          'id,name,hostPattern,typeLabel',
        ]);
        let result: unknown;
        try {
          result = JSON.parse(stdout);
        } catch {
          result = stdout.trim();
        }
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'success',
          result,
        });
      } catch (err) {
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'error',
          error: String(err),
        });
      }
      logger.info({ sourceGroup }, 'OneCLI secrets listed via admin IPC');
      break;
    }

    case 'admin_onecli_create_secret': {
      if (!isMain) {
        logger.warn(
          { sourceGroup },
          'Unauthorized admin_onecli_create_secret blocked',
        );
        break;
      }
      if (
        !data.requestId ||
        !data.name ||
        !data.secretType ||
        !data.value ||
        !data.hostPattern
      ) {
        if (data.requestId) {
          writeIpcResponse(sourceGroup, data.requestId, {
            requestId: data.requestId,
            status: 'error',
            error:
              'Missing required fields: name, secretType, value, hostPattern',
          });
        }
        break;
      }
      try {
        const args = [
          'secrets',
          'create',
          '--name',
          data.name,
          '--type',
          data.secretType,
          '--value',
          data.value,
          '--host-pattern',
          data.hostPattern,
        ];
        if (data.headerName) args.push('--header-name', data.headerName);
        if (data.pathPattern) args.push('--path-pattern', data.pathPattern);
        if (data.valueFormat) args.push('--value-format', data.valueFormat);

        const { stdout } = await execOneCLI(args);
        let result: unknown;
        try {
          result = JSON.parse(stdout);
        } catch {
          result = stdout.trim();
        }
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'success',
          result,
        });
        logger.info(
          { name: data.name, sourceGroup },
          'OneCLI secret created via admin IPC',
        );
      } catch (err) {
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'error',
          error: String(err),
        });
        logger.error(
          { name: data.name, sourceGroup, err },
          'OneCLI secret creation failed',
        );
      }
      break;
    }

    case 'admin_onecli_agent_secrets': {
      if (!isMain) {
        logger.warn(
          { sourceGroup },
          'Unauthorized admin_onecli_agent_secrets blocked',
        );
        break;
      }
      if (!data.requestId || !data.agentIdentifier) break;
      if (!SAFE_ID_RE.test(data.agentIdentifier)) {
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'error',
          error: 'Invalid agentIdentifier format',
        });
        break;
      }
      try {
        const { stdout } = await execOneCLI([
          'agents',
          'secrets',
          '--id',
          data.agentIdentifier,
        ]);
        let result: unknown;
        try {
          result = JSON.parse(stdout);
        } catch {
          result = stdout.trim();
        }
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'success',
          result,
        });
      } catch (err) {
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'error',
          error: String(err),
        });
      }
      logger.info(
        { agentIdentifier: data.agentIdentifier, sourceGroup },
        'OneCLI agent secrets queried via admin IPC',
      );
      break;
    }

    case 'admin_onecli_assign_secrets': {
      if (!isMain) {
        logger.warn(
          { sourceGroup },
          'Unauthorized admin_onecli_assign_secrets blocked',
        );
        break;
      }
      if (!data.requestId || !data.agentIdentifier || !data.secretIds?.length) {
        if (data.requestId) {
          writeIpcResponse(sourceGroup, data.requestId, {
            requestId: data.requestId,
            status: 'error',
            error: 'Missing required fields: agentIdentifier, secretIds',
          });
        }
        break;
      }
      if (
        !SAFE_ID_RE.test(data.agentIdentifier) ||
        !data.secretIds.every((id: string) => SAFE_ID_RE.test(id))
      ) {
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'error',
          error: 'Invalid agentIdentifier or secretId format',
        });
        break;
      }
      try {
        const { stdout } = await execOneCLI([
          'agents',
          'set-secrets',
          '--id',
          data.agentIdentifier,
          '--secret-ids',
          data.secretIds.join(','),
        ]);
        let result: unknown;
        try {
          result = JSON.parse(stdout);
        } catch {
          result = stdout.trim();
        }
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'success',
          result,
        });
        logger.info(
          {
            agentIdentifier: data.agentIdentifier,
            secretIds: data.secretIds,
            sourceGroup,
          },
          'OneCLI secrets assigned via admin IPC',
        );
      } catch (err) {
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'error',
          error: String(err),
        });
        logger.error(
          { agentIdentifier: data.agentIdentifier, sourceGroup, err },
          'OneCLI secret assignment failed',
        );
      }
      break;
    }

    case 'admin_onecli_delete_secret': {
      if (!isMain) {
        logger.warn(
          { sourceGroup },
          'Unauthorized admin_onecli_delete_secret blocked',
        );
        break;
      }
      if (!data.requestId || !data.secretId) {
        if (data.requestId) {
          writeIpcResponse(sourceGroup, data.requestId, {
            requestId: data.requestId,
            status: 'error',
            error: 'Missing required field: secretId',
          });
        }
        break;
      }
      if (!SAFE_ID_RE.test(data.secretId)) {
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'error',
          error: 'Invalid secretId format',
        });
        break;
      }
      try {
        const { stdout } = await execOneCLI([
          'secrets',
          'delete',
          '--id',
          data.secretId,
        ]);
        let result: unknown;
        try {
          result = JSON.parse(stdout);
        } catch {
          result = stdout.trim();
        }
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'success',
          result,
        });
        logger.info(
          { secretId: data.secretId, sourceGroup },
          'OneCLI secret deleted via admin IPC',
        );
      } catch (err) {
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'error',
          error: String(err),
        });
        logger.error(
          { secretId: data.secretId, sourceGroup, err },
          'OneCLI secret deletion failed',
        );
      }
      break;
    }

    case 'admin_onecli_update_secret': {
      if (!isMain) {
        logger.warn(
          { sourceGroup },
          'Unauthorized admin_onecli_update_secret blocked',
        );
        break;
      }
      if (!data.requestId || !data.secretId) {
        if (data.requestId) {
          writeIpcResponse(sourceGroup, data.requestId, {
            requestId: data.requestId,
            status: 'error',
            error: 'Missing required field: secretId',
          });
        }
        break;
      }
      if (!SAFE_ID_RE.test(data.secretId)) {
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'error',
          error: 'Invalid secretId format',
        });
        break;
      }
      try {
        const args = ['secrets', 'update', '--id', data.secretId];
        if (data.value) args.push('--value', data.value);
        if (data.hostPattern) args.push('--host-pattern', data.hostPattern);
        if (data.pathPattern) args.push('--path-pattern', data.pathPattern);
        if (data.headerName) args.push('--header-name', data.headerName);
        if (data.valueFormat) args.push('--value-format', data.valueFormat);

        const { stdout } = await execOneCLI(args);
        let result: unknown;
        try {
          result = JSON.parse(stdout);
        } catch {
          result = stdout.trim();
        }
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'success',
          result,
        });
        logger.info(
          { secretId: data.secretId, sourceGroup },
          'OneCLI secret updated via admin IPC',
        );
      } catch (err) {
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'error',
          error: String(err),
        });
        logger.error(
          { secretId: data.secretId, sourceGroup, err },
          'OneCLI secret update failed',
        );
      }
      break;
    }

    case 'admin_get_container_config': {
      if (!isMain) {
        logger.warn(
          { sourceGroup },
          'Unauthorized admin_get_container_config blocked',
        );
        break;
      }
      if (!data.requestId || !data.jid) {
        if (data.requestId) {
          writeIpcResponse(sourceGroup, data.requestId, {
            requestId: data.requestId,
            status: 'error',
            error: 'Missing required field: jid',
          });
        }
        break;
      }
      const targetGroup = getRegisteredGroup(data.jid);
      if (!targetGroup) {
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'error',
          error: `Group not found: ${data.jid}`,
        });
        break;
      }
      writeIpcResponse(sourceGroup, data.requestId, {
        requestId: data.requestId,
        status: 'success',
        result: {
          jid: data.jid,
          name: targetGroup.name,
          folder: targetGroup.folder,
          containerConfig: targetGroup.containerConfig ?? null,
        },
      });
      logger.info(
        { jid: data.jid, sourceGroup },
        'Container config queried via admin IPC',
      );
      break;
    }

    case 'admin_list_groups': {
      if (!isMain) {
        logger.warn(
          { sourceGroup },
          'Unauthorized admin_list_groups blocked',
        );
        break;
      }
      if (!data.requestId) break;
      const allGroups = getAllRegisteredGroups();
      const groupList = Object.entries(allGroups).map(([jid, g]) => ({
        jid,
        name: g.name,
        folder: g.folder,
        trigger: g.trigger,
        isMain: g.isMain ?? false,
        containerConfig: g.containerConfig ?? null,
      }));
      writeIpcResponse(sourceGroup, data.requestId, {
        requestId: data.requestId,
        status: 'success',
        result: groupList,
      });
      logger.info({ sourceGroup }, 'Groups listed via admin IPC');
      break;
    }

    case 'admin_delete_group': {
      if (!isMain) {
        logger.warn(
          { sourceGroup },
          'Unauthorized admin_delete_group blocked',
        );
        break;
      }
      if (!data.requestId || !data.jid) {
        if (data.requestId) {
          writeIpcResponse(sourceGroup, data.requestId, {
            requestId: data.requestId,
            status: 'error',
            error: 'Missing required field: jid',
          });
        }
        break;
      }
      const groupToDelete = getRegisteredGroup(data.jid);
      if (!groupToDelete) {
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'error',
          error: `Group not found: ${data.jid}`,
        });
        break;
      }
      if (groupToDelete.isMain) {
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'error',
          error: 'Cannot delete the main group',
        });
        break;
      }
      // Remove from database
      deleteRegisteredGroup(data.jid);
      // Clean up session
      deleteSession(groupToDelete.folder);
      // Clean up IPC directory (best-effort)
      const ipcDir = path.join(DATA_DIR, 'ipc', groupToDelete.folder);
      try {
        fs.rmSync(ipcDir, { recursive: true, force: true });
      } catch {
        // Non-critical — log and continue
      }
      // Clean up OneCLI agent entry (best-effort)
      const agentId = groupToDelete.folder.toLowerCase().replace(/_/g, '-');
      try {
        await execOneCLI(['agents', 'delete', '--id', agentId]);
      } catch {
        // Agent may not exist — that's fine
      }
      writeIpcResponse(sourceGroup, data.requestId, {
        requestId: data.requestId,
        status: 'success',
        result: {
          deleted: data.jid,
          name: groupToDelete.name,
          folder: groupToDelete.folder,
        },
      });
      logger.info(
        { jid: data.jid, folder: groupToDelete.folder, sourceGroup },
        'Group deleted via admin IPC',
      );
      break;
    }

    case 'admin_reset_session': {
      if (!isMain) {
        logger.warn(
          { sourceGroup },
          'Unauthorized admin_reset_session blocked',
        );
        break;
      }
      if (!data.requestId || !data.jid) {
        if (data.requestId) {
          writeIpcResponse(sourceGroup, data.requestId, {
            requestId: data.requestId,
            status: 'error',
            error: 'Missing required field: jid',
          });
        }
        break;
      }
      const sessionGroup = getRegisteredGroup(data.jid);
      if (!sessionGroup) {
        writeIpcResponse(sourceGroup, data.requestId, {
          requestId: data.requestId,
          status: 'error',
          error: `Group not found: ${data.jid}`,
        });
        break;
      }
      deleteSession(sessionGroup.folder);
      writeIpcResponse(sourceGroup, data.requestId, {
        requestId: data.requestId,
        status: 'success',
        result: {
          jid: data.jid,
          folder: sessionGroup.folder,
          message: 'Session cleared — next message will start a fresh conversation',
        },
      });
      logger.info(
        { jid: data.jid, folder: sessionGroup.folder, sourceGroup },
        'Session reset via admin IPC',
      );
      break;
    }

    default:
      logger.warn({ type: data.type }, 'Unknown IPC task type');
  }
}
