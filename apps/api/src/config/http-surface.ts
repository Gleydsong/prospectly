import type { CorsOptions, CorsOptionsDelegate } from '@nestjs/common/interfaces/external/cors-options.interface';

export const API_GLOBAL_PREFIX = 'api';

export const API_GLOBAL_PREFIX_EXCLUDE = [
  'health',
  'health/live',
  'health/ready',
  'mcp',
  '.well-known/oauth-protected-resource',
  '.well-known/oauth-authorization-server',
];

export const MCP_CORS_EXPOSE_HEADERS = [
  'WWW-Authenticate',
  'Mcp-Session-Id',
  'Mcp-Protocol-Version',
];

const API_CORS_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Correlation-Id',
  'X-Requested-With',
];

export function isOpenCorsPath(path: string): boolean {
  const pathname = path.split('?')[0] ?? '';
  return pathname === '/mcp' || pathname.startsWith('/.well-known/');
}

export function createCorsDelegate(allowlist: string[]): CorsOptionsDelegate<unknown> {
  const apiCors: CorsOptions = {
    origin: allowlist,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: API_CORS_HEADERS,
  };
  const openCors: CorsOptions = {
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [...API_CORS_HEADERS, 'Mcp-Session-Id', 'Mcp-Protocol-Version'],
    exposedHeaders: MCP_CORS_EXPOSE_HEADERS,
  };
  return (req, callback) => {
    const request = req as { path?: string; url?: string };
    const path = request.path ?? request.url ?? '';
    callback(null, isOpenCorsPath(path) ? openCors : apiCors);
  };
}
