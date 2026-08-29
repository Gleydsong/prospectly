import {
  isBlockedIp,
  assertSafePublicUrl,
  createPinnedLookup,
  SsrfBlockedError,
} from './ssrf';

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

  it('returns the literal public IP as the pinned address', async () => {
    const safe = await assertSafePublicUrl('http://8.8.8.8/health');
    expect(safe.url.toString()).toBe('http://8.8.8.8/health');
    expect(safe.addresses).toEqual(['8.8.8.8']);
  });

  it('pins lookup to validated addresses and never returns other IPs', () => {
    const lookup = createPinnedLookup(['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']);
    const single = new Promise<{ address: string; family: number }>((resolve, reject) => {
      lookup('example.com', {}, (err, address, family) => {
        if (err) reject(err);
        else resolve({ address: address as string, family: family as number });
      });
    });

    return expect(single).resolves.toEqual({ address: '93.184.216.34', family: 4 });
  });
});
