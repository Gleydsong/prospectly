import { isBlockedIp, assertSafePublicUrl, SsrfBlockedError } from './ssrf';

describe('ssrf guards', () => {
  it('blocks private IPv4 ranges', () => {
    expect(isBlockedIp('127.0.0.1')).toBe(true);
    expect(isBlockedIp('10.0.0.5')).toBe(true);
    expect(isBlockedIp('192.168.1.1')).toBe(true);
    expect(isBlockedIp('172.16.0.1')).toBe(true);
    expect(isBlockedIp('169.254.1.1')).toBe(true);
    expect(isBlockedIp('8.8.8.8')).toBe(false);
  });

  it('rejects localhost and credentialed URLs', async () => {
    await expect(assertSafePublicUrl('http://localhost/admin')).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
    await expect(assertSafePublicUrl('http://user:pass@example.com')).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
    await expect(assertSafePublicUrl('ftp://example.com')).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(assertSafePublicUrl('http://127.0.0.1/')).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it('rejects cloud metadata hostnames', async () => {
    await expect(assertSafePublicUrl('http://metadata.google.internal/')).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
    await expect(assertSafePublicUrl('http://169.254.169.254/latest')).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });
});
