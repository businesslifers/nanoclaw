#!/usr/bin/env npx tsx
/**
 * Schema validation for agents.json files.
 *
 * Reads each group's agents.json and validates structure, required fields,
 * and allowed values. Uses the same validator as the agent-runner runtime.
 *
 * Usage:
 *   npx tsx scripts/validate-agents.ts whatsapp_ghost-team
 *   npx tsx scripts/validate-agents.ts --all
 */

import fs from 'fs';
import path from 'path';
import { validateAgentDefinitions, type ValidationError } from '../container/agent-runner/src/validate-agents.js';

// --- Helpers ---

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
}

function formatError(e: ValidationError): string {
  const prefix = e.agent ? `[${e.agent}]` : '';
  const field = e.field ? `.${e.field}` : '';
  return `${prefix}${field} ${e.message}`;
}

function printResult(r: CheckResult): void {
  const icons: Record<string, string> = {
    pass: `${GREEN}PASS${RESET}`,
    fail: `${RED}FAIL${RESET}`,
    warn: `${YELLOW}WARN${RESET}`,
    skip: `${DIM}SKIP${RESET}`,
  };
  console.log(`  ${icons[r.status]}  ${r.name}`);
  if (r.status !== 'pass' && r.message) {
    console.log(`         ${DIM}${r.message}${RESET}`);
  }
}

function validateGroupAgents(groupFolder: string, groupsDir: string): CheckResult[] {
  const results: CheckResult[] = [];
  const agentsPath = path.join(groupsDir, groupFolder, 'agents.json');

  // File exists?
  if (!fs.existsSync(agentsPath)) {
    results.push({ name: 'agents.json exists', status: 'skip', message: 'No agents.json — this group has no agent team' });
    return results;
  }
  results.push({ name: 'agents.json exists', status: 'pass', message: '' });

  // Valid JSON?
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(agentsPath, 'utf-8'));
  } catch (e) {
    results.push({ name: 'Valid JSON', status: 'fail', message: `${e}` });
    return results;
  }
  results.push({ name: 'Valid JSON', status: 'pass', message: '' });

  // Schema validation
  const result = validateAgentDefinitions(parsed);

  for (const e of result.errors) {
    results.push({ name: `Schema: ${formatError(e)}`, status: 'fail', message: '' });
  }
  for (const w of result.warnings) {
    results.push({ name: `Schema: ${formatError(w)}`, status: 'warn', message: '' });
  }

  if (result.valid && result.warnings.length === 0) {
    const count = Object.keys(parsed as object).length;
    results.push({ name: `Schema valid (${count} agent${count === 1 ? '' : 's'})`, status: 'pass', message: '' });
  }

  return results;
}

// --- Main ---

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx tsx scripts/validate-agents.ts <group-folder | --all>');
    process.exit(1);
  }

  const groupsDir = path.join(process.cwd(), 'groups');

  let folders: string[];
  if (args[0] === '--all') {
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

  const summaries: Array<{ folder: string; passed: number; failed: number; warned: number; skipped: boolean }> = [];

  for (const folder of folders) {
    console.log(`\n${BOLD}${folder}${RESET}`);
    console.log('─'.repeat(folder.length + 4));

    const results = validateGroupAgents(folder, groupsDir);
    results.forEach(printResult);

    const passed = results.filter((r) => r.status === 'pass').length;
    const failed = results.filter((r) => r.status === 'fail').length;
    const warned = results.filter((r) => r.status === 'warn').length;
    const skipped = results.some((r) => r.status === 'skip');
    summaries.push({ folder, passed, failed, warned, skipped });

    if (skipped) {
      console.log(`\n  ${DIM}Skipped — no agents.json${RESET}`);
    } else if (failed === 0) {
      console.log(`\n  ${GREEN}All ${passed} checks passed${warned > 0 ? ` (${warned} warning${warned === 1 ? '' : 's'})` : ''}${RESET}`);
    } else {
      console.log(`\n  ${RED}${failed} check(s) failed${RESET}, ${passed} passed`);
    }
  }

  // Summary table for --all
  if (folders.length > 1) {
    console.log(`\n${BOLD}Summary${RESET}`);
    console.log('─'.repeat(60));
    for (const s of summaries) {
      let status: string;
      if (s.skipped) status = `${DIM}SKIP${RESET}`;
      else if (s.failed > 0) status = `${RED}${s.failed} FAIL${RESET}`;
      else status = `${GREEN}PASS${RESET}`;
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
