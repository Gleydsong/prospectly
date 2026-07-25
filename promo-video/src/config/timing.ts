import { VIDEO } from './dimensions';

const { fps } = VIDEO;

/** Scene durations in frames (≈40s total before transition overlap). */
export const SCENE_FRAMES = {
  intro: 3 * fps, // 90
  landing: 8 * fps, // 240
  demo: 22 * fps, // 660
  outro: 5 * fps, // 150
  transition: Math.round(0.5 * fps), // 15
} as const;

/** Extra frames added to the demo sequence to land near 40s after fades. */
export const DEMO_EXTRA_FRAMES = 105;

/**
 * TransitionSeries shortens the timeline by each transition duration.
 * Total = intro + landing + (demo+extra) + outro - 3*transition
 * = 90 + 240 + 765 + 150 - 45 = 1200 frames (40s @ 30fps).
 */
export const PROMO_DURATION_IN_FRAMES =
  SCENE_FRAMES.intro +
  SCENE_FRAMES.landing +
  SCENE_FRAMES.demo +
  DEMO_EXTRA_FRAMES +
  SCENE_FRAMES.outro -
  3 * SCENE_FRAMES.transition;

export const EASING = {
  softOut: [0.16, 1, 0.3, 1] as const,
  softInOut: [0.45, 0, 0.55, 1] as const,
} as const;

export const SPRING = {
  gentle: { damping: 18, stiffness: 80, mass: 1 },
  soft: { damping: 200, stiffness: 100, mass: 1 },
  snappy: { damping: 20, stiffness: 120, mass: 0.8 },
} as const;

/** Demo segment markers (relative to demo scene start), in frames. */
export const DEMO_BEATS = {
  loginHold: 0,
  loginType: 1.2 * fps,
  loginClick: 4 * fps,
  dashboardHold: 5.5 * fps,
  searchNav: 8 * fps,
  searchFill: 10 * fps,
  searchSubmit: 14 * fps,
  leadsNav: 16.5 * fps,
  leadsHold: 18 * fps,
  pipelineNav: 21 * fps,
  pipelineHold: 22 * fps,
} as const;
