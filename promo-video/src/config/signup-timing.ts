import { VIDEO } from './dimensions';

const { fps } = VIDEO;

/** Shared durations for short signup tutorials (~28s). */
export const SIGNUP_FRAMES = {
  intro: 2.5 * fps, // 75
  step: 5 * fps, // 150
  outro: 4 * fps, // 120
  transition: Math.round(0.45 * fps), // 14
} as const;

/**
 * HowToCreateAccount:
 * intro + registerEmpty + registerFilled + dashboard + outro − 4 transitions
 * = 75 + 150 + 180 + 120 + 120 − 56 = 589 → bump filled to hit ~25s
 */
export const HOW_TO_CREATE_ACCOUNT_FRAMES = {
  intro: SIGNUP_FRAMES.intro,
  registerEmpty: 5 * fps,
  registerFilled: 7 * fps,
  dashboard: 4 * fps,
  outro: SIGNUP_FRAMES.outro,
  transition: SIGNUP_FRAMES.transition,
} as const;

export const HOW_TO_CREATE_ACCOUNT_DURATION =
  HOW_TO_CREATE_ACCOUNT_FRAMES.intro +
  HOW_TO_CREATE_ACCOUNT_FRAMES.registerEmpty +
  HOW_TO_CREATE_ACCOUNT_FRAMES.registerFilled +
  HOW_TO_CREATE_ACCOUNT_FRAMES.dashboard +
  HOW_TO_CREATE_ACCOUNT_FRAMES.outro -
  4 * HOW_TO_CREATE_ACCOUNT_FRAMES.transition;

/**
 * CreateFreeAccount:
 * intro + landing + register + filled + success + outro − 5 transitions
 */
export const CREATE_FREE_ACCOUNT_FRAMES = {
  intro: SIGNUP_FRAMES.intro,
  landing: 5.5 * fps,
  registerEmpty: 4.5 * fps,
  registerFilled: 6 * fps,
  success: 4 * fps,
  outro: SIGNUP_FRAMES.outro,
  transition: SIGNUP_FRAMES.transition,
} as const;

export const CREATE_FREE_ACCOUNT_DURATION =
  CREATE_FREE_ACCOUNT_FRAMES.intro +
  CREATE_FREE_ACCOUNT_FRAMES.landing +
  CREATE_FREE_ACCOUNT_FRAMES.registerEmpty +
  CREATE_FREE_ACCOUNT_FRAMES.registerFilled +
  CREATE_FREE_ACCOUNT_FRAMES.success +
  CREATE_FREE_ACCOUNT_FRAMES.outro -
  5 * CREATE_FREE_ACCOUNT_FRAMES.transition;
