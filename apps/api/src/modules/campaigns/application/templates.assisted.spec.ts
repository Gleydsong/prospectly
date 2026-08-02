import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('templates.service assisted guarantees', () => {
  const source = readFileSync(
    join(__dirname, 'templates.service.ts'),
    'utf8',
  );

  it('never enables autoSend in preview responses', () => {
    expect(source).toContain('autoSend: false');
    expect(source).toContain('messageSent: false');
    expect(source).toContain('Assisted preview only');
  });
});
