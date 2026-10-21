import { ConfigService } from '@nestjs/config';

import { QUESTIONS, resolveLayaTimeoutMs, SdrLayaClient } from './sdr-laya.client';

describe('SdrLayaClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function createClient(configValues: Record<string, unknown> = {}) {
    const config = {
      get: jest.fn((key: string) => configValues[key]),
    } as unknown as ConfigService;
    return new SdrLayaClient(config);
  }

  const sampleAnswers = {
    icpFit: {
      type: 'score',
      score: 1.2,
      legend: { '0': 'none', '1': 'partial', '2': 'full' },
      probabilities: { '0': 0.1, '1': 0.6, '2': 0.3 },
      confidence: 0.7,
    },
    websiteNeed: { type: 'noul', noul: 1.0 },
    businessActivity: { type: 'noul', noul: 1.0 },
    commercialOpportunity: {
      type: 'score',
      score: 1.1,
      legend: { '0': 'none', '1': 'partial', '2': 'full' },
      probabilities: { '0': 0.1, '1': 0.7, '2': 0.2 },
      confidence: 0.7,
    },
    contactability: { type: 'noul', noul: 1.0 },
    buyingSignals: { type: 'noul', noul: 0.9 },
    risk: {
      type: 'score',
      score: 0.2,
      legend: { '0': 'none', '1': 'partial', '2': 'full' },
      probabilities: { '0': 0.8, '1': 0.2 },
      confidence: 0.8,
    },
    strategy: {
      type: 'choice',
      choice: 'website_problem',
      probabilities: { website_problem: 0.9 },
      confidence: 0.9,
    },
    intent: {
      type: 'choice',
      choice: 'UNKNOWN',
      probabilities: { UNKNOWN: 1.0 },
      confidence: 0.6,
    },
  };

  it('successfully judges a customer state on happy path', async () => {
    const client = createClient({
      'laya.url': 'http://laya-sidecar:8000/v1/systemone',
      'laya.model': 'multilingual',
      'laya.timeoutMs': 15000,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ answers: sampleAnswers }),
    });

    const request = { prospectId: 'prospect-123' };
    const result = (await client.judge(request)) as { answers: unknown };

    expect(global.fetch).toHaveBeenCalledWith(
      'http://laya-sidecar:8000/v1/systemone',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'multilingual',
          state: request,
          questions: QUESTIONS,
        }),
      }),
    );
    expect(result.answers).toEqual(sampleAnswers);
  });

  it('fails closed when Laya returns HTTP error', async () => {
    const client = createClient();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    await expect(client.judge({ prospectId: 'p-1' })).rejects.toThrow('laya http 503');
  });

  it('fails closed when Laya response is missing answers', async () => {
    const client = createClient();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ output: 'something else' }),
    });

    await expect(client.judge({ prospectId: 'p-1' })).rejects.toThrow('laya response missing answers');
  });

  it('fails closed when Laya response answers is an array', async () => {
    const client = createClient();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ answers: [] }),
    });

    await expect(client.judge({ prospectId: 'p-1' })).rejects.toThrow('laya response missing answers');
  });

  it('fails closed on network timeout', async () => {
    const client = createClient({ 'laya.timeoutMs': 50 });
    global.fetch = jest.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    });

    await expect(client.judge({ prospectId: 'p-1' })).rejects.toThrow('The operation was aborted');
  });

  describe('resolveLayaTimeoutMs', () => {
    it('returns default 20000 for invalid or negative values', () => {
      expect(resolveLayaTimeoutMs(undefined)).toBe(20000);
      expect(resolveLayaTimeoutMs(null)).toBe(20000);
      expect(resolveLayaTimeoutMs(-500)).toBe(20000);
      expect(resolveLayaTimeoutMs('invalid')).toBe(20000);
    });

    it('returns valid numeric value clamped to maximum 30000', () => {
      expect(resolveLayaTimeoutMs(5000)).toBe(5000);
      expect(resolveLayaTimeoutMs(25000)).toBe(25000);
      expect(resolveLayaTimeoutMs(60000)).toBe(30000);
    });
  });
});
