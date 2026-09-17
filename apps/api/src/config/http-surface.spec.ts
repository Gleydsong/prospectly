import {
  API_GLOBAL_PREFIX_EXCLUDE,
  createCorsDelegate,
  isOpenCorsPath,
  MCP_CORS_EXPOSE_HEADERS,
} from './http-surface';

describe('http-surface', () => {
  it('excludes health, mcp and well-known from the api prefix', () => {
    expect(API_GLOBAL_PREFIX_EXCLUDE).toEqual(
      expect.arrayContaining([
        'health',
        'mcp',
        '.well-known/oauth-protected-resource',
        '.well-known/oauth-authorization-server',
      ]),
    );
  });

  it('opens CORS only for MCP and discovery paths', () => {
    expect(isOpenCorsPath('/mcp')).toBe(true);
    expect(isOpenCorsPath('/.well-known/oauth-protected-resource')).toBe(true);
    expect(isOpenCorsPath('/api/v1/oauth/token')).toBe(false);
    expect(isOpenCorsPath('/api/v1/leads')).toBe(false);
  });

  it('uses wildcard origin without credentials for MCP paths', () => {
    const delegate = createCorsDelegate(['http://localhost:5173']);
    const mcp = { path: '/mcp' };
    const api = { path: '/api/v1/leads' };
    delegate(mcp, (_err, options) => {
      expect(options?.origin).toBe('*');
      expect(options?.credentials).toBe(false);
      expect(options?.exposedHeaders).toEqual(MCP_CORS_EXPOSE_HEADERS);
    });
    delegate(api, (_err, options) => {
      expect(options?.origin).toEqual(['http://localhost:5173']);
      expect(options?.credentials).toBe(true);
    });
  });
});
