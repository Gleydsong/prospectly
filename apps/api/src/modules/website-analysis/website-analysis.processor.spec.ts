import { WebsiteAnalysisProcessor } from './website-analysis.processor';

describe('WebsiteAnalysisProcessor', () => {
  it('delegates analyze-website jobs to the service', async () => {
    const websiteAnalysis = {
      processAnalysis: jest.fn().mockResolvedValue(undefined),
    };
    const processor = new WebsiteAnalysisProcessor(websiteAnalysis as never);
    await processor.process({
      name: 'analyze-website',
      data: {
        organizationId: 'o1',
        leadId: 'l1',
        analysisId: 'a1',
        url: 'https://example.com',
      },
    } as never);
    expect(websiteAnalysis.processAnalysis).toHaveBeenCalledWith({
      organizationId: 'o1',
      leadId: 'l1',
      analysisId: 'a1',
      url: 'https://example.com',
    });
  });
});
