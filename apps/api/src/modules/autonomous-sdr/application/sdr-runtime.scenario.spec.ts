import { runLocalSdrScenario } from './sdr-runtime.scenario';

describe('runLocalSdrScenario', () => {
  it('qualifies the fake oficina and keeps autonomous sending off', async () => {
    const view = await runLocalSdrScenario();

    expect(view.autonomy.autonomousSending).toBe(false);
    expect(view.prospects).toEqual([
      { id: 'prospect-1', name: 'Oficina Alfa', score: 56, state: 'QUALIFIED' },
    ]);
    expect(view.decision).toEqual({ qualification: 'QUALIFIED', traceId: 'trace-local' });
    expect(view.message.status).toBe('BLOCK');
    expect(view.review).toEqual([{ prospectId: 'prospect-1', reason: 'feature_flag' }]);
    expect(view.metrics.blocked).toBe(1);
  });
});
