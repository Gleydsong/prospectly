import { z } from 'zod';

export const mcpLimitSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});

export class McpInvalidParamsError extends Error {
  readonly code = 'invalid_params' as const;

  constructor(message: string) {
    super(message);
    this.name = 'McpInvalidParamsError';
  }
}

export type McpExtract = (
  resource: 'summary' | 'leads' | 'searches',
  limit?: number,
) => Promise<unknown>;

export async function runMcpTool(
  extract: McpExtract,
  resource: 'summary' | 'leads' | 'searches',
  raw: unknown,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  let limit: number | undefined;
  if (resource !== 'summary') {
    const parsed = mcpLimitSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      throw new McpInvalidParamsError('limit must be an integer between 1 and 100');
    }
    limit = parsed.data.limit;
  }
  const data = await extract(resource, limit);
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}
