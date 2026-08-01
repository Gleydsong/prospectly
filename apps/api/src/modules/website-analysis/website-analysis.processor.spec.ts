import { WebsiteAnalysisProcessor } from './website-analysis.processor';

describe('WebsiteAnalysisProcessor', () => {
  it('delegates analyze-website jobs to the service and logs correlationId', async () => {
    const websiteAnalysis = {
      processAnalysis: jest.fn().mockResolvedValue(undefined),
    };
    const metrics = { recordJob: jest.fn() };
    const processor = new WebsiteAnalysisProcessor(websiteAnalysis as never, metrics as never);
    await processor.process({
      name: 'analyze-website',
      data: {
        organizationId: 'o1',
        leadId: 'l1',
        analysisId: 'a1',
        url: 'https://example.com',
        correlationId: 'corr-wa-1',
      },
      attemptsMade: 0,
      opts: { attempts: 2 },
    } as never);
    expect(websiteAnalysis.processAnalysis).toHaveBeenCalledWith({
      organizationId: 'o1',
      leadId: 'l1',
      analysisId: 'a1',
      url: 'https://example.com',
      correlationId: 'corr-wa-1',
    });
    expect(metrics.recordJob).toHaveBeenCalledWith('website-analysis', 'completed', expect.any(Number));
  });

  it('records retry metrics when attempts remain', async () => {
    const websiteAnalysis = {
      processAnalysis: jest.fn().mockRejectedValue(new Error('temporary')),
    };
    const metrics = { recordJob: jest.fn() };
    const processor = new WebsiteAnalysisProcessor(websiteAnalysis as never, metrics as never);

    await expect(
      processor.process({
        name: 'analyze-website',
        data: {
          organizationId: 'o1',
          leadId: 'l1',
          analysisId: 'a1',
          url: 'https://example.com',
        },
        attemptsMade: 0,
        opts: { attempts: 2 },
      } as never),
    ).rejects.toThrow('temporary');

    expect(metrics.recordJob).toHaveBeenCalledWith('website-analysis', 'retry', expect.any(Number));
  });
});
