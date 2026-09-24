export const SDR_AUTONOMY_FLAG_KEYS = [
  'autonomousDiscovery',
  'autonomousQualification',
  'autonomousResearch',
  'autonomousSending',
  'autonomousFollowup',
  'autonomousReply',
] as const;

export type SdrAutonomyFlagKey = (typeof SDR_AUTONOMY_FLAG_KEYS)[number];

const FLAG_KEYS = new Set<string>(SDR_AUTONOMY_FLAG_KEYS);

export function isSdrAutonomyFlagKey(value: string): value is SdrAutonomyFlagKey {
  return FLAG_KEYS.has(value);
}

export function defaultAutonomyFlags(): Record<SdrAutonomyFlagKey, boolean> {
  return {
    autonomousDiscovery: false,
    autonomousQualification: false,
    autonomousResearch: false,
    autonomousSending: false,
    autonomousFollowup: false,
    autonomousReply: false,
  };
}

export function isAutonomyActionEnabled(
  flags: Partial<Record<SdrAutonomyFlagKey, boolean>>,
  key: string,
): boolean {
  if (!isSdrAutonomyFlagKey(key)) return false;
  return flags[key] === true;
}
