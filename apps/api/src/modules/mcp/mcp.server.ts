import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { runMcpTool, type McpExtract } from './mcp-tools';

const readOnly = { readOnlyHint: true as const };
const limitShape = {
  limit: z.number().int().min(1).max(100).optional(),
};

export function createProspectlyMcpServer(extract: McpExtract): McpServer {
  const server = new McpServer(
    { name: 'prospectly', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.registerTool(
    'get_org_summary',
    {
      description: 'Organization summary: name, plan, credits, lead and search counts.',
      annotations: readOnly,
    },
    async () => runMcpTool(extract, 'summary', {}),
  );

  server.registerTool(
    'list_leads',
    {
      description: 'List leads without contact PII (no email, phone, or notes).',
      inputSchema: limitShape,
      annotations: readOnly,
    },
    async ({ limit }) => runMcpTool(extract, 'leads', { limit }),
  );

  server.registerTool(
    'list_searches',
    {
      description: 'List saved searches.',
      inputSchema: limitShape,
      annotations: readOnly,
    },
    async ({ limit }) => runMcpTool(extract, 'searches', { limit }),
  );

  return server;
}
