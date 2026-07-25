import { VIDEO } from './dimensions';

const { fps } = VIDEO;

export const PRICING_VIDEO_FRAMES = {
  intro: 2.5 * fps,
  freeHook: 4 * fps,
  monthly: 8 * fps,
  lifetime: 6 * fps,
  currencies: 4.5 * fps,
  outro: 4 * fps,
  transition: Math.round(0.45 * fps),
} as const;

/** Sum of scenes minus 5 fade overlaps ≈ 30s. */
export const PRICING_VIDEO_DURATION =
  PRICING_VIDEO_FRAMES.intro +
  PRICING_VIDEO_FRAMES.freeHook +
  PRICING_VIDEO_FRAMES.monthly +
  PRICING_VIDEO_FRAMES.lifetime +
  PRICING_VIDEO_FRAMES.currencies +
  PRICING_VIDEO_FRAMES.outro -
  5 * PRICING_VIDEO_FRAMES.transition;
