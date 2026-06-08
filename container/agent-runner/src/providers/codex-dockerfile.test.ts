// Structural guard for the Codex CLI install in container/Dockerfile.
//
// @openai/codex is a CLI *binary* installed via the Dockerfile, not an
// importable package, so the barrel-driven registration tests cannot see it.
// This test reads the real Dockerfile and asserts the version ARG and the
// `pnpm install -g` line for @openai/codex are both present. It goes red if
// either Dockerfile edit is dropped or drifts.
//
// Runs under bun (same suite as the container registration test):
//   cd container/agent-runner && bun test src/providers/codex-dockerfile.test.ts

import { readFileSync } from 'fs';
import path from 'path';

import { describe, it, expect } from 'bun:test';

// container/agent-runner/src/providers/ -> container/Dockerfile
const DOCKERFILE = path.join(import.meta.dir, '..', '..', '..', 'Dockerfile');

describe('container/Dockerfile codex CLI install', () => {
  const dockerfile = readFileSync(DOCKERFILE, 'utf8');

  it('declares the CODEX_VERSION ARG', () => {
    expect(dockerfile).toMatch(/ARG\s+CODEX_VERSION=/);
  });

  it('installs the @openai/codex CLI pinned to that ARG', () => {
    expect(dockerfile).toMatch(/pnpm install -g\s+"@openai\/codex@\$\{CODEX_VERSION\}"/);
  });
});
