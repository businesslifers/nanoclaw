/**
 * Philosophy Guardrails
 *
 * NanoClaw's core philosophy: "Small enough to understand."
 * These tests enforce that constraint with hard numbers. If a change
 * breaches a limit, it should either be simplified or made into a skill.
 *
 * Current state (2026-04-08): 29 files, ~10.2K lines, 10 dependencies.
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..');

describe('philosophy guardrails', () => {
  it('source file count stays small', () => {
    const files = execSync(
      `find src -name '*.ts' ! -name '*.test.ts' ! -name '*.spec.ts'`,
      { cwd: root, encoding: 'utf-8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean);

    expect(files.length).toBeLessThanOrEqual(35);
  });

  it('total lines of source code stays small', () => {
    const lines = execSync(
      `find src -name '*.ts' ! -name '*.test.ts' ! -name '*.spec.ts' -exec cat {} + | wc -l`,
      { cwd: root, encoding: 'utf-8' },
    ).trim();

    expect(Number(lines)).toBeLessThanOrEqual(12_000);
  });

  it('production dependency count stays small', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
    const deps = Object.keys(pkg.dependencies || {});

    expect(deps.length).toBeLessThanOrEqual(15);
  });
});
