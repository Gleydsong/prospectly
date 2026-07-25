import React from 'react';
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { SPRING } from '../config/timing';
import { COLORS, FONTS, TYPOGRAPHY } from '../config/theme';

type SceneCaptionProps = {
  readonly text: string;
  /** Optional short accent line above the caption (max ~3 words). */
  readonly eyebrow?: string;
  readonly delay?: number;
};

/**
 * Lower-third caption — centered, minimal, brand-aligned.
 * Prefer short copy; avoid stacking with on-screen callouts.
 */
export const SceneCaption: React.FC<SceneCaptionProps> = ({
  text,
  eyebrow,
  delay = 8,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({
    frame: frame - delay,
    fps,
    config: SPRING.soft,
  });

  const exitStart = Math.max(durationInFrames - 14, delay + 20);
  const exitOpacity = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  const opacity =
    interpolate(enter, [0, 1], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }) * exitOpacity;
  const translateY = interpolate(enter, [0, 1], [14, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 56,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        opacity,
        transform: `translateY(${translateY}px)`,
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      <div
        style={{
          width: 36,
          height: 2,
          borderRadius: 2,
          backgroundColor: COLORS.emerald400,
          boxShadow: `0 0 16px ${COLORS.glowEmerald}`,
        }}
      />
      {eyebrow ? (
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: COLORS.emerald400,
          }}
        >
          {eyebrow}
        </span>
      ) : null}
      <p
        style={{
          margin: 0,
          fontFamily: FONTS.display,
          fontSize: TYPOGRAPHY.supporting,
          fontWeight: 550,
          letterSpacing: '-0.03em',
          color: COLORS.zinc50,
          textAlign: 'center',
          lineHeight: 1.2,
          textShadow: '0 8px 32px rgba(0,0,0,0.55)',
        }}
      >
        {text}
      </p>
    </div>
  );
};
