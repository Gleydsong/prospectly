import { McpInvalidParamsError, runMcpTool, type McpExtract } from './mcp-tools';

describe('runMcpTool', () => {
  it('calls extract summary for the token organization', async () => {
    const extract: McpExtract = jest.fn().mockResolvedValue({ leadCount: 2 });
    const result = await runMcpTool(extract, 'summary', {});
    expect(extract).toHaveBeenCalledWith('summary', undefined);
    expect(result.content[0]?.text).toContain('leadCount');
  });

  it('rejects a limit outside 1–100 as invalid_params', async () => {
    const extract: McpExtract = jest.fn();
    await expect(runMcpTool(extract, 'leads', { limit: 0 })).rejects.toBeInstanceOf(
      McpInvalidParamsError,
    );
    await expect(runMcpTool(extract, 'searches', { limit: 101 })).rejects.toMatchObject({
      code: 'invalid_params',
    });
    expect(extract).not.toHaveBeenCalled();
  });

  it('forwards a valid leads limit to extract', async () => {
    const extract: McpExtract = jest.fn().mockResolvedValue([]);
    await runMcpTool(extract, 'leads', { limit: 10 });
    expect(extract).toHaveBeenCalledWith('leads', 10);
  });
});
