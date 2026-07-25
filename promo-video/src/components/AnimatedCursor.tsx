import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { SPRING } from '../config/timing';
import { COLORS } from '../config/theme';

type Point = { readonly x: number; readonly y: number };

type AnimatedCursorProps = {
  readonly path: readonly Point[];
  /** Frame at which the cursor starts moving along the path. */
  readonly startFrame?: number;
  /** Frames to travel the full path. */
  readonly durationInFrames?: number;
  readonly clickingAt?: readonly number[];
};

export const AnimatedCursor: React.FC<AnimatedCursorProps> = ({
  path,
  startFrame = 0,
  durationInFrames = 45,
  clickingAt = [],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;

  if (path.length === 0 || local < -5) {
    return null;
  }

  const progress = interpolate(local, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ease along polyline
  const segmentCount = Math.max(path.length - 1, 1);
  const scaled = progress * segmentCount;
  const segmentIndex = Math.min(Math.floor(scaled), segmentCount - 1);
  const segmentT = scaled - segmentIndex;
  const easedT = interpolate(segmentT, [0, 1], [0, 1], {
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  const from = path[segmentIndex] ?? path[0];
  const to = path[segmentIndex + 1] ?? from;
  const x = interpolate(easedT, [0, 1], [from.x, to.x]);
  const y = interpolate(easedT, [0, 1], [from.y, to.y]);

  const isClicking = clickingAt.some(
    (clickFrame) => local >= clickFrame && local <= clickFrame + 6,
  );
  const clickSpring = spring({
    frame: isClicking ? 4 : 0,
    fps,
    config: SPRING.snappy,
  });
  const scale = interpolate(clickSpring, [0, 1], [1, 0.82]);
  const opacity = interpolate(local, [-5, 0], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        zIndex: 50,
        pointerEvents: 'none',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.45))',
      }}
    >
      <svg width="32" height="36" viewBox="0 0 24 28" fill="none">
        <path
          d="M3 2L3 22L8.5 16.5L13 26L16 24.5L11.5 15H19L3 2Z"
          fill={COLORS.zinc50}
          stroke={COLORS.ink}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      {isClicking ? (
        <div
          style={{
            position: 'absolute',
            left: -10,
            top: -10,
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: `2px solid ${COLORS.emerald400}`,
            opacity: 0.7,
          }}
        />
      ) : null}
    </div>
  );
};
