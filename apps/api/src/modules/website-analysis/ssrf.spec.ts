import { isBlockedIp, assertSafePublicUrl, SsrfBlockedError } from './ssrf';

describe('ssrf guards', () => {
  it('blocks private IPv4 ranges', () => {
    expect(isBlockedIp('127.0.0.1')).toBe(true);
    expect(isBlockedIp('10.0.0.5')).toBe(true);
    expect(isBlockedIp('192.168.1.1')).toBe(true);
    expect(isBlockedIp('172.16.0.1')).toBe(true);
    expect(isBlockedIp('169.254.1.1')).toBe(true);
    expect(isBlockedIp('8.8.8.8')).toBe(false);
    expect(isBlockedIp('256.1.1.1')).toBe(true);
    expect(isBlockedIp('198.51.100.10')).toBe(true);
    expect(isBlockedIp('224.0.0.1')).toBe(true);
  });

  it('blocks non-public IPv6 ranges and IPv4-mapped addresses', () => {
    expect(isBlockedIp('::')).toBe(true);
    expect(isBlockedIp('::1')).toBe(true);
    expect(isBlockedIp('fe80::1')).toBe(true);
    expect(isBlockedIp('ff02::1')).toBe(true);
    expect(isBlockedIp('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedIp('2606:4700:4700::1111')).toBe(false);
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
