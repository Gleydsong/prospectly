export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
  aspectRatio: '16:9',
} as const;

/** Safe margins for 1920×1080 (skill: video-layout). */
export const SAFE_AREA = {
  horizontal: 100,
  vertical: 100,
} as const;

export const BROWSER_CHROME = {
  width: 1600,
  height: 900,
  borderRadius: 16,
  titleBarHeight: 44,
  trafficLightSize: 12,
  trafficLightGap: 8,
} as const;
