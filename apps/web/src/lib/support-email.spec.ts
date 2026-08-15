import { describe, expect, it } from 'vitest';

import { SUPPORT_EMAIL, buildSupportMailto } from './support-email';

describe('buildSupportMailto', () => {
  it('points to the support inbox with encoded subject and body', () => {
    const href = buildSupportMailto({
      subject: 'Erro no funil',
      details: 'Não consigo mover o lead',
      fromName: 'Ana',
      fromEmail: 'ana@agency.dev',
    });

    expect(href).toMatch(new RegExp(`^mailto:${SUPPORT_EMAIL}\\?`));
    expect(href).toContain(encodeURIComponent('Erro no funil'));
    expect(href).toContain(encodeURIComponent('Não consigo mover o lead'));
    expect(href).toContain(encodeURIComponent('ana@agency.dev'));
  });

  it('rejects empty subject or details', () => {
    expect(buildSupportMailto({ subject: '  ', details: 'ok' })).toBeNull();
    expect(buildSupportMailto({ subject: 'ok', details: '' })).toBeNull();
  });
});
