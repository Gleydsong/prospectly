import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('worker HTTP bootstrap', () => {
  const source = readFileSync(join(__dirname, 'worker.ts'), 'utf8');

  it('starts a Nest application context and never opens an HTTP listener', () => {
    expect(source).toContain('createApplicationContext');
    expect(source).toContain('BullMQ worker context started (no HTTP listener)');
    expect(source).not.toMatch(/\.listen\s*\(/);
    expect(source).toContain("process.env.ROLE = 'worker'");
  });
});
