import { ScoringProcessor } from './scoring.processor';

describe('ScoringProcessor', () => {
  it('propagates correlationId in success logs and records duration', async () => {
    const scoring = {
      recalculateOrganization: jest.fn().mockResolvedValue(3),
    };
    const metrics = { recordJob: jest.fn() };
    const processor = new ScoringProcessor(scoring as never, metrics as never);

    await processor.process({
      name: 'recalculate-org-scores',
      data: { organizationId: 'o1', correlationId: 'corr-score-1' },
      attemptsMade: 0,
      opts: { attempts: 2 },
    } as never);

    expect(scoring.recalculateOrganization).toHaveBeenCalledWith('o1');
    expect(metrics.recordJob).toHaveBeenCalledWith('scoring', 'completed', expect.any(Number));
  });

  it('records failed metrics on final attempt', async () => {
    const scoring = {
      recalculateOrganization: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const metrics = { recordJob: jest.fn() };
    const processor = new ScoringProcessor(scoring as never, metrics as never);

    await expect(
      processor.process({
        name: 'recalculate-org-scores',
        data: { organizationId: 'o1' },
        attemptsMade: 1,
        opts: { attempts: 2 },
      } as never),
    ).rejects.toThrow('boom');

    expect(metrics.recordJob).toHaveBeenCalledWith('scoring', 'failed', expect.any(Number));
  });
});
