import { UnrecoverableError } from 'bullmq';

import { OpportunityFinderProcessor } from './opportunity-finder.processor';

describe('OpportunityFinderProcessor niche failures', () => {
  it('does not retry deterministic niche failures', async () => {
    const service = {
      getJobContext: jest.fn().mockResolvedValue(null),
      processRun: jest.fn().mockRejectedValue(new Error('NICHE_NOT_IDENTIFIED')),
      recordFailure: jest.fn().mockResolvedValue(undefined),
    };
    const metrics = { recordJob: jest.fn() };
    const processor = new OpportunityFinderProcessor(service as never, metrics as never);
    const job = {
      name: 'process-opportunity-run',
      data: { runId: 'run-1' },
      attemptsMade: 0,
      opts: { attempts: 2 },
    };

    await expect(processor.process(job as never)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(service.recordFailure).toHaveBeenCalledWith('run-1', 'NICHE_NOT_IDENTIFIED');
    expect(metrics.recordJob).toHaveBeenCalledWith('opportunity-finder', 'failed', expect.any(Number));
  });
});
