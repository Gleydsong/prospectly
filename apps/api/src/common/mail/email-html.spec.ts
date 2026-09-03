import { assertSafeRecipient, escapeHtml, isSafeHttpUrl, sanitizeHeaderValue } from './email-html';

describe('email-html', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    );
  });

  it('strips CR/LF from header values', () => {
    expect(sanitizeHeaderValue('Hello\r\nBcc: evil@x.com')).toBe('Hello Bcc: evil@x.com');
  });

  it('rejects unsafe recipients', () => {
    expect(() => assertSafeRecipient('not-an-email')).toThrow('Invalid email recipient');
    expect(() => assertSafeRecipient('ana@agency.dev\nBcc:evil@x.com')).toThrow(
      'Invalid email recipient',
    );
  });

  it('accepts a normal recipient', () => {
    expect(assertSafeRecipient('Ana@Agency.dev')).toBe('ana@agency.dev');
  });

  it('only allows http(s) URLs', () => {
    expect(isSafeHttpUrl('https://app.prospectlyonboard.com/credits')).toBe(true);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,hi')).toBe(false);
  });
});
