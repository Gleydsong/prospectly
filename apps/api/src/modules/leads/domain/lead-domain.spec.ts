import { normalizeLeadDomain } from './lead-domain';

describe('normalizeLeadDomain', () => {
  it('normalizes a domain starting with http prefix without scheme (issue #318)', () => {
    expect(normalizeLeadDomain('httpsolucoes.com.br')).toBe('httpsolucoes.com.br');
  });

  it('normalizes a domain starting with www. and uppercase characters', () => {
    expect(normalizeLeadDomain('www.Acme.com')).toBe('acme.com');
  });

  it('normalizes a full URL with scheme and path', () => {
    expect(normalizeLeadDomain('https://acme.com/path')).toBe('acme.com');
  });

  it('handles http scheme and query strings / hashes', () => {
    expect(normalizeLeadDomain('http://www.example.org/path?query=1#section')).toBe('example.org');
  });

  it('handles plain domain without scheme or www', () => {
    expect(normalizeLeadDomain('example.com')).toBe('example.com');
  });

  it('handles subdomain preserving non-www subdomains in lowercase', () => {
    expect(normalizeLeadDomain('https://Blog.Acme.com')).toBe('blog.acme.com');
    expect(normalizeLeadDomain('www.blog.acme.com')).toBe('blog.acme.com');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeLeadDomain('   https://acme.com/path   ')).toBe('acme.com');
    expect(normalizeLeadDomain('   www.Acme.com   ')).toBe('acme.com');
  });

  it('returns null for null, undefined, and empty/whitespace inputs', () => {
    expect(normalizeLeadDomain(null)).toBeNull();
    expect(normalizeLeadDomain(undefined)).toBeNull();
    expect(normalizeLeadDomain('')).toBeNull();
    expect(normalizeLeadDomain('    ')).toBeNull();
  });

  it('returns null for malformed or unparseable URLs', () => {
    expect(normalizeLeadDomain('http://')).toBeNull();
    expect(normalizeLeadDomain(':::')).toBeNull();
  });
});
