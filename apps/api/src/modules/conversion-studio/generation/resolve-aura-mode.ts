import type { GenerateLandingJobData } from './landing-generation.constants';

/**
 * Decide generation mode for lead / Google-link flows.
 * When AI is preferred but quota is exhausted, fall back to TEMPLATE so the
 * primary create UX keeps working (regression from c1a0969).
 */
export function resolveAuraMode(
  preferAi: boolean,
  hasAiQuota: boolean,
  aiMode: 'AI_LEAD' | 'AI_GOOGLE',
): { mode: GenerateLandingJobData['mode']; useAi: boolean } {
  if (!preferAi || !hasAiQuota) {
    return { mode: 'TEMPLATE', useAi: false };
  }
  return { mode: aiMode, useAi: true };
}
