import { mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const script = join(process.cwd(), 'scripts/assert-deploy-bundle.mjs');

function run(distDir: string) {
  return spawnSync(process.execPath, [script, distDir], {
    encoding: 'utf8',
  });
}

describe('assert-deploy-bundle.mjs', () => {
  it('ignores vendor localhost sentinels and flags baked dev URLs', () => {
    const clean = mkdtempSync(join(tmpdir(), 'web-dist-clean-'));
    writeFileSync(
      join(clean, 'vendor.js'),
      'let origin="http://localhost"; const sidecar="http://localhost:8969/stream";',
    );
    writeFileSync(join(clean, 'app.js'), 'const api="https://api.example.com/api/v1";');
    const ok = run(clean);
    expect(ok.status).toBe(0);
    expect(ok.stderr).toBe('');

    const leak = mkdtempSync(join(tmpdir(), 'web-dist-leak-'));
    writeFileSync(join(leak, 'leak.js'), 'const api="http://localhost:3000/api/v1";');
    const failed = run(leak);
    expect(failed.status).toBe(1);
    expect(failed.stderr).toMatch(/http:\/\/localhost:3000/);
    expect(failed.stderr).toMatch(/leak\.js/);
    expect(failed.stderr).not.toMatch(/\/api\/v1/);
  });
});
