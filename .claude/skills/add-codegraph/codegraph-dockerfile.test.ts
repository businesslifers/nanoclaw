/**
 * Structural guard for the codegraph Dockerfile reach-in (the binary install).
 *
 * codegraph ships as a self-contained GitHub-release tarball, not an npm
 * package, so it can't be imported or typechecked. The only red-on-drift guard
 * is asserting the install layer is present in container/Dockerfile: drop the
 * layer on an upgrade and the container starts but every wired group's
 * `codegraph serve --mcp` fails with "codegraph: command not found", with
 * nothing else failing. This test reads the Dockerfile and asserts the
 * CODEGRAPH_VERSION ARG, the release download, and the PATH symlink are present.
 */
import fs from 'fs';
import path from 'path';

import { describe, it, expect } from 'vitest';

function dockerfile(): string {
  // From src/ up to repo root, then into container/.
  const p = path.resolve(__dirname, '..', 'container', 'Dockerfile');
  return fs.readFileSync(p, 'utf8');
}

describe('container/Dockerfile installs the codegraph binary', () => {
  const text = dockerfile();

  it('declares the CODEGRAPH_VERSION build arg', () => {
    expect(text).toMatch(/ARG\s+CODEGRAPH_VERSION/);
  });

  it('downloads the codegraph release tarball', () => {
    expect(text).toContain('colbymchenry/codegraph/releases/download');
  });

  it('symlinks the codegraph binary onto PATH', () => {
    expect(text).toMatch(/ln\s+-sf\s+\/opt\/codegraph\/bin\/codegraph\s+\/usr\/local\/bin\/codegraph/);
  });
});
