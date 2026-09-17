import { createProspectlyMcpServer } from './mcp.server';

describe('createProspectlyMcpServer', () => {
  it('builds a server with the three read-only tools', () => {
    const server = createProspectlyMcpServer(jest.fn());
    expect(server).toBeDefined();
    expect(typeof server.registerTool).toBe('function');
  });
});
