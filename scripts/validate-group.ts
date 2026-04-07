#!/usr/bin/env npx tsx
/**
 * Pre-flight validation for NanoClaw group manifests.
 *
 * Reads a group's manifest.json and checks that all OneCLI secrets,
 * mounts, and external dependencies are correctly configured.
 *
 * Usage:
 *   npx tsx scripts/validate-group.ts whatsapp_insights-team
 *   npx tsx scripts/validate-group.ts --all
 */

import { execSync } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';

const require = createRequire(import.meta.url);

// --- Types (inline — scripts are outside tsconfig rootDir) ---

interface ManifestSecret {
  name: string;
  type: 'anthropic' | 'generic';
  host_pattern?: string;
  header_name?: string;
  credential_access?: 'proxy' | 'file';
}

interface ManifestMount {
  host_path: string;
  container_path: string;
  readonly: boolean;
}

interface ManifestDependency {
  path: string;
  description: string;
  credential_access?: 'proxy' | 'file';
  container_path?: string;
}

interface Manifest {
  registration: {
    name: string;
    channel: string;
    trigger_pattern: string;
    requires_trigger: boolean;
    is_main: boolean;
  };
  onecli: {
    agent_name: string;
    agent_identifier: string;
    secret_mode: string;
    required_secrets: ManifestSecret[];
  };
  mounts: ManifestMount[];
  external_dependencies: ManifestDependency[];
}

interface OneCLIAgent {
  id: string;
  name: string;
  identifier: string;
  secretMode: string;
}

interface OneCLISecret {
  id: string;
  name: string;
  type: string;
  hostPattern: string | null;
}

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

// --- Helpers ---

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function pass(name: string, message: string): CheckResult {
  return { name, passed: true, message };
}

function fail(name: string, message: string): CheckResult {
  return { name, passed: false, message };
}

function expandHome(p: string): string {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function execJson<T>(cmd: string): T | null {
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(out.trim());
  } catch {
    return null;
  }
}

function printResult(r: CheckResult): void {
  const icon = r.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`  ${icon}  ${r.name}`);
  if (!r.passed) {
    console.log(`         ${DIM}${r.message}${RESET}`);
  }
}

// --- Checks ---

function checkManifestExists(groupDir: string): { result: CheckResult; manifest?: Manifest } {
  const manifestPath = path.join(groupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { result: fail('Manifest exists', `Missing: ${manifestPath} — see docs/credential-patterns.md`) };
  }
  try {
    const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return { result: pass('Manifest exists', ''), manifest };
  } catch (e) {
    return { result: fail('Manifest exists', `Invalid JSON: ${e}`) };
  }
}

function checkOneCLIAgent(
  manifest: Manifest,
  agents: OneCLIAgent[],
): { result: CheckResult; agent?: OneCLIAgent } {
  const identifier = manifest.onecli.agent_identifier;
  if (!identifier) {
    // Main group uses default agent
    const defaultAgent = agents.find((a) => a.isDefault);
    if (defaultAgent) return { result: pass('OneCLI agent exists', ''), agent: defaultAgent };
    return { result: fail('OneCLI agent exists', 'No default agent found'), agent: undefined };
  }
  const agent = agents.find((a) => a.identifier === identifier);
  if (!agent) {
    return {
      result: fail(
        'OneCLI agent exists',
        `No agent with identifier "${identifier}". Run: onecli agents create --name "${manifest.onecli.agent_name}" --identifier "${identifier}"`,
      ),
    };
  }
  return { result: pass('OneCLI agent exists', ''), agent };
}

function checkSecretsExist(
  manifest: Manifest,
  allSecrets: OneCLISecret[],
): { result: CheckResult; secretIdMap: Map<string, string> } {
  const secretIdMap = new Map<string, string>();
  const missing: string[] = [];

  for (const req of manifest.onecli.required_secrets) {
    // Match by name first, then fall back to type+host_pattern.
    // The Anthropic secret is often named "Anthropic" in OneCLI but
    // referenced as "nanoclaw" in manifests, so we also match by type.
    const found =
      allSecrets.find((s) => s.name.toLowerCase() === req.name.toLowerCase()) ||
      (req.host_pattern
        ? allSecrets.find(
            (s) =>
              s.type === req.type &&
              s.hostPattern?.toLowerCase() === req.host_pattern!.toLowerCase(),
          )
        : undefined);
    if (found) {
      secretIdMap.set(req.name, found.id);
    } else {
      missing.push(req.name);
    }
  }

  if (missing.length > 0) {
    return {
      result: fail(
        'Required secrets exist in OneCLI',
        `Missing secrets: ${missing.join(', ')}. Run: onecli secrets create --name "<name>" --type "<type>" --value "<value>" --host-pattern "<host>"`,
      ),
      secretIdMap,
    };
  }
  return { result: pass('Required secrets exist in OneCLI', ''), secretIdMap };
}

function checkSecretsAssigned(
  manifest: Manifest,
  agent: OneCLIAgent,
  secretIdMap: Map<string, string>,
): CheckResult {
  const assignedIds = execJson<string[]>(`onecli agents secrets --id ${agent.id}`);
  if (!assignedIds) {
    return fail('Secrets assigned to agent', 'Could not query agent secrets');
  }

  const assignedSet = new Set(assignedIds);
  const unassigned: string[] = [];

  for (const req of manifest.onecli.required_secrets) {
    const secretId = secretIdMap.get(req.name);
    if (secretId && !assignedSet.has(secretId)) {
      unassigned.push(`${req.name} (${secretId})`);
    }
  }

  if (unassigned.length > 0) {
    const allNeededIds = manifest.onecli.required_secrets
      .map((r) => secretIdMap.get(r.name))
      .filter(Boolean);
    const mergedIds = [...new Set([...assignedIds, ...allNeededIds])].join(',');
    return fail(
      'Secrets assigned to agent',
      `Unassigned: ${unassigned.join(', ')}. Run: onecli agents set-secrets --id ${agent.id} --secret-ids ${mergedIds}`,
    );
  }
  return pass('Secrets assigned to agent', '');
}

function checkSecretMode(manifest: Manifest, agent: OneCLIAgent): CheckResult {
  if (agent.secretMode !== manifest.onecli.secret_mode) {
    return fail(
      'Agent secret mode matches',
      `Agent has "${agent.secretMode}", manifest expects "${manifest.onecli.secret_mode}". Run: onecli agents set-secret-mode --id ${agent.id} --mode ${manifest.onecli.secret_mode}`,
    );
  }
  return pass('Agent secret mode matches', '');
}

function checkMountHostPaths(manifest: Manifest): CheckResult {
  const missing: string[] = [];
  for (const m of manifest.mounts) {
    const resolved = expandHome(m.host_path);
    if (!fs.existsSync(resolved)) {
      missing.push(resolved);
    }
  }
  if (missing.length > 0) {
    return fail(
      'Mount host paths exist',
      `Missing directories: ${missing.join(', ')}. Run: mkdir -p ${missing.join(' ')}`,
    );
  }
  if (manifest.mounts.length === 0) {
    return pass('Mount host paths exist', '');
  }
  return pass('Mount host paths exist', '');
}

function checkMountAllowlist(manifest: Manifest): CheckResult {
  if (manifest.mounts.length === 0) return pass('Mount allowlist permits paths', '');

  const allowlistPath = path.join(os.homedir(), '.config', 'nanoclaw', 'mount-allowlist.json');
  if (!fs.existsSync(allowlistPath)) {
    return fail(
      'Mount allowlist permits paths',
      `Allowlist not found at ${allowlistPath}. Create it with allowedRoots covering your mount paths.`,
    );
  }

  let allowlist: { allowedRoots: Array<{ path: string }>; blockedPatterns: string[] };
  try {
    allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  } catch {
    return fail('Mount allowlist permits paths', `Invalid JSON in ${allowlistPath}`);
  }

  const denied: string[] = [];
  for (const m of manifest.mounts) {
    const resolved = path.resolve(expandHome(m.host_path));
    const allowed = allowlist.allowedRoots.some((root) => {
      const rootResolved = path.resolve(expandHome(root.path));
      return resolved === rootResolved || resolved.startsWith(rootResolved + '/');
    });
    if (!allowed) {
      denied.push(m.host_path);
    }
  }

  if (denied.length > 0) {
    return fail(
      'Mount allowlist permits paths',
      `Not in allowlist: ${denied.join(', ')}. Add parent directory to allowedRoots in ${allowlistPath}`,
    );
  }
  return pass('Mount allowlist permits paths', '');
}

function checkExternalDeps(manifest: Manifest): CheckResult {
  const missing: string[] = [];
  for (const dep of manifest.external_dependencies) {
    if (!dep.credential_access) continue; // Non-file deps (like allowlist reference) skip
    const resolved = expandHome(dep.path);
    if (!fs.existsSync(resolved)) {
      missing.push(`${resolved} (${dep.description})`);
    }
  }
  if (missing.length > 0) {
    return fail(
      'External dependency files exist',
      `Missing: ${missing.join('; ')}`,
    );
  }
  return pass('External dependency files exist', '');
}

function checkDBContainerConfig(manifest: Manifest, groupFolder: string): CheckResult {
  if (manifest.mounts.length === 0) return pass('DB container config matches manifest', '');

  const dbPath = path.join(process.cwd(), 'store', 'messages.db');
  if (!fs.existsSync(dbPath)) {
    return fail('DB container config matches manifest', `Database not found at ${dbPath}`);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare('SELECT container_config FROM registered_groups WHERE folder = ?').get(groupFolder) as
      | { container_config: string | null }
      | undefined;
    db.close();

    if (!row) {
      return fail(
        'DB container config matches manifest',
        `Group "${groupFolder}" not found in registered_groups. Register it first.`,
      );
    }

    const dbConfig = row.container_config ? JSON.parse(row.container_config) : {};
    const dbMounts: Array<{ hostPath: string; containerPath?: string; readonly?: boolean }> =
      dbConfig.additionalMounts || [];

    const manifestMountSet = new Set(
      manifest.mounts.map((m) => `${expandHome(m.host_path)}:${m.container_path}`),
    );
    const dbMountSet = new Set(
      dbMounts.map((m) => `${expandHome(m.hostPath)}:${m.containerPath || ''}`),
    );

    const missingInDb = [...manifestMountSet].filter((m) => !dbMountSet.has(m));
    if (missingInDb.length > 0) {
      return fail(
        'DB container config matches manifest',
        `Mounts in manifest but not in DB: ${missingInDb.join(', ')}. Re-register the group with correct containerConfig.`,
      );
    }
    return pass('DB container config matches manifest', '');
  } catch (e) {
    return fail('DB container config matches manifest', `DB query failed: ${e}`);
  }
}

function checkCLAUDEMDCredentials(manifest: Manifest, groupDir: string): CheckResult {
  const claudePath = path.join(groupDir, 'CLAUDE.md');
  if (!fs.existsSync(claudePath)) {
    return pass('CLAUDE.md documents file credentials', ''); // No CLAUDE.md is ok for new groups
  }

  const content = fs.readFileSync(claudePath, 'utf8');
  const fileDeps = manifest.external_dependencies.filter((d) => d.credential_access === 'file' && d.container_path);
  if (fileDeps.length === 0) return pass('CLAUDE.md documents file credentials', '');

  const undocumented: string[] = [];
  for (const dep of fileDeps) {
    if (!content.includes(dep.container_path!)) {
      undocumented.push(`${dep.container_path} (${dep.description})`);
    }
  }

  if (undocumented.length > 0) {
    return fail(
      'CLAUDE.md documents file credentials',
      `Not documented in CLAUDE.md: ${undocumented.join('; ')}. Add to the Credentials section so the agent knows how to access them.`,
    );
  }
  return pass('CLAUDE.md documents file credentials', '');
}

// --- Main ---

function checkLargeDirectories(groupDir: string): CheckResult {
  const WARN_THRESHOLD = 500; // files
  const KNOWN_LARGE = ['node_modules', '.git'];
  const ignorePath = path.join(groupDir, '.claudeignore');
  let ignorePatterns: string[] = [];
  if (fs.existsSync(ignorePath)) {
    ignorePatterns = fs
      .readFileSync(ignorePath, 'utf-8')
      .split('\n')
      .map((l) => l.trim().replace(/\/$/, ''))
      .filter((l) => l && !l.startsWith('#'));
  }

  const problems: string[] = [];
  try {
    const entries = fs.readdirSync(groupDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirName = entry.name;
      if (['logs', 'wiki', 'sources', 'conversations', '.git'].includes(dirName)) continue;

      // Check if ignored by .claudeignore
      const isIgnored = ignorePatterns.some(
        (p) => p === dirName || p === `${dirName}/` || dirName.match(new RegExp(`^${p.replace('*', '.*')}$`)),
      );
      if (isIgnored) continue;

      // Count files in this directory
      let fileCount = 0;
      try {
        const countDir = (dir: string) => {
          for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
            if (f.isDirectory()) countDir(path.join(dir, f.name));
            else fileCount++;
            if (fileCount > WARN_THRESHOLD) return; // early exit
          }
        };
        countDir(path.join(groupDir, dirName));
      } catch {
        continue;
      }

      if (fileCount > WARN_THRESHOLD) {
        problems.push(
          `${dirName}/ has ${fileCount}+ files and is NOT in .claudeignore — this inflates container token costs`,
        );
      }
    }
  } catch {
    return pass('Container context size', 'Could not scan group directory');
  }

  if (problems.length > 0) {
    return fail('Container context size', problems.join('; '));
  }
  return pass(
    'Container context size',
    fs.existsSync(ignorePath) ? '.claudeignore present' : 'no large directories found',
  );
}

function validateGroup(groupFolder: string, agents: OneCLIAgent[], secrets: OneCLISecret[]): CheckResult[] {
  const groupsDir = path.join(process.cwd(), 'groups');
  const groupDir = path.join(groupsDir, groupFolder);
  const results: CheckResult[] = [];

  // 0. Container context size (runs even without manifest)
  results.push(checkLargeDirectories(groupDir));

  // 1. Manifest exists
  const { result: manifestResult, manifest } = checkManifestExists(groupDir);
  results.push(manifestResult);
  if (!manifest) return results;

  // 2. OneCLI agent exists
  const { result: agentResult, agent } = checkOneCLIAgent(manifest, agents);
  results.push(agentResult);

  // 3. Required secrets exist
  const { result: secretsResult, secretIdMap } = checkSecretsExist(manifest, secrets);
  results.push(secretsResult);

  // 4. Secrets assigned to agent
  if (agent && secretIdMap.size > 0) {
    results.push(checkSecretsAssigned(manifest, agent, secretIdMap));
  } else if (manifest.onecli.required_secrets.length > 0 && !agent) {
    results.push(fail('Secrets assigned to agent', 'Cannot check — agent not found'));
  } else {
    results.push(pass('Secrets assigned to agent', ''));
  }

  // 5. Secret mode
  if (agent) {
    results.push(checkSecretMode(manifest, agent));
  } else {
    results.push(fail('Agent secret mode matches', 'Cannot check — agent not found'));
  }

  // 6. Mount host paths
  results.push(checkMountHostPaths(manifest));

  // 7. Mount allowlist
  results.push(checkMountAllowlist(manifest));

  // 8. External dependency files
  results.push(checkExternalDeps(manifest));

  // 9. DB container config
  results.push(checkDBContainerConfig(manifest, groupFolder));

  // 10. CLAUDE.md credentials
  results.push(checkCLAUDEMDCredentials(manifest, groupDir));

  return results;
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx tsx scripts/validate-group.ts <group-folder | --all>');
    process.exit(1);
  }

  // Load OneCLI data once
  console.log(`${DIM}Loading OneCLI data...${RESET}`);
  const agents = execJson<OneCLIAgent[]>('onecli agents list') || [];
  const secrets = execJson<OneCLISecret[]>('onecli secrets list') || [];

  if (agents.length === 0) {
    console.log(`${YELLOW}Warning: Could not load OneCLI agents — OneCLI checks will be skipped${RESET}`);
  }

  const groupsDir = path.join(process.cwd(), 'groups');

  let folders: string[];
  if (args[0] === '--all') {
    // Find all group directories (excluding global and symlinks)
    folders = fs
      .readdirSync(groupsDir)
      .filter((f) => {
        const fullPath = path.join(groupsDir, f);
        try {
          const stat = fs.lstatSync(fullPath);
          return stat.isDirectory() && !stat.isSymbolicLink() && f !== 'global' && f !== 'main';
        } catch {
          return false;
        }
      })
      .sort();
  } else {
    folders = [args[0]];
  }

  const summaries: Array<{ folder: string; passed: number; failed: number }> = [];

  for (const folder of folders) {
    console.log(`\n${BOLD}${folder}${RESET}`);
    console.log('─'.repeat(folder.length + 4));

    const results = validateGroup(folder, agents, secrets);
    results.forEach(printResult);

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    summaries.push({ folder, passed, failed });

    if (failed === 0) {
      console.log(`\n  ${GREEN}All ${passed} checks passed${RESET}`);
    } else {
      console.log(`\n  ${RED}${failed} check(s) failed${RESET}, ${passed} passed`);
    }
  }

  // Summary table for --all
  if (folders.length > 1) {
    console.log(`\n${BOLD}Summary${RESET}`);
    console.log('─'.repeat(60));
    for (const s of summaries) {
      const status = s.failed === 0 ? `${GREEN}PASS${RESET}` : `${RED}${s.failed} FAIL${RESET}`;
      console.log(`  ${s.folder.padEnd(40)} ${status}`);
    }
    const totalFailed = summaries.reduce((acc, s) => acc + s.failed, 0);
    if (totalFailed > 0) {
      console.log(`\n  ${RED}${totalFailed} total failure(s) across ${summaries.filter((s) => s.failed > 0).length} group(s)${RESET}`);
    } else {
      console.log(`\n  ${GREEN}All groups passed${RESET}`);
    }
  }

  const anyFailed = summaries.some((s) => s.failed > 0);
  process.exit(anyFailed ? 1 : 0);
}

main();
