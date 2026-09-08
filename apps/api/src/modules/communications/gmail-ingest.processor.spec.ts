import { GmailIngestProcessor } from './gmail-ingest.processor';

describe('GmailIngestProcessor', () => {
  it('runs tenant-scoped sync for connection jobs', async () => {
    const ingest = {
      syncConnection: jest.fn().mockResolvedValue(undefined),
      sweepActiveConnections: jest.fn(),
    };
    const metrics = { recordJob: jest.fn() };
    const processor = new GmailIngestProcessor(ingest as never, metrics as never);
    await processor.process({
      name: 'sync-gmail-connection',
      data: { organizationId: 'org-1', connectionId: 'conn-1', correlationId: 'c1' },
      attemptsMade: 0,
      opts: { attempts: 2 },
    } as never);
    expect(ingest.syncConnection).toHaveBeenCalledWith('org-1', 'conn-1');
    expect(metrics.recordJob).toHaveBeenCalledWith('gmail-sync', 'completed', expect.any(Number));
    expect(JSON.stringify(ingest.syncConnection.mock.calls)).not.toContain('snippet');
  });

  it('sweeps active connections without a payload body', async () => {
    const ingest = {
      syncConnection: jest.fn(),
      sweepActiveConnections: jest.fn().mockResolvedValue(undefined),
    };
    const processor = new GmailIngestProcessor(ingest as never, { recordJob: jest.fn() } as never);
    await processor.process({ name: 'sweep-gmail-connections', data: {} } as never);
    expect(ingest.sweepActiveConnections).toHaveBeenCalled();
    expect(ingest.syncConnection).not.toHaveBeenCalled();
  });
});
