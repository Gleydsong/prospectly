import { resolveAuraMode } from './resolve-aura-mode';

describe('resolveAuraMode (TEMPLATE fallback)', () => {
  it('uses AI when provider prefers AI and quota remains', () => {
    expect(resolveAuraMode(true, true, 'AI_LEAD')).toEqual({ mode: 'AI_LEAD', useAi: true });
    expect(resolveAuraMode(true, true, 'AI_GOOGLE')).toEqual({ mode: 'AI_GOOGLE', useAi: true });
  });

  it('falls back to TEMPLATE when AI quota is exhausted', () => {
    expect(resolveAuraMode(true, false, 'AI_LEAD')).toEqual({ mode: 'TEMPLATE', useAi: false });
    expect(resolveAuraMode(true, false, 'AI_GOOGLE')).toEqual({ mode: 'TEMPLATE', useAi: false });
  });

  it('uses TEMPLATE when AI provider is not preferred', () => {
    expect(resolveAuraMode(false, true, 'AI_LEAD')).toEqual({ mode: 'TEMPLATE', useAi: false });
  });
});
