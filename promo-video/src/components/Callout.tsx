import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { SPRING } from '../config/timing';
import { COLORS, FONTS, TYPOGRAPHY } from '../config/theme';

type CalloutProps = {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly delay?: number;
  readonly accent?: 'emerald' | 'blue';
};

const MAX_WORDS = 8;

export const Callout: React.FC<CalloutProps> = ({
  text,
  x,
  y,
  delay = 0,
  accent = 'emerald',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.trim().split(/\s+/);
  if (words.length > MAX_WORDS) {
    throw new Error(`Callout exceeds ${MAX_WORDS} words: "${text}"`);
  }

  const progress = spring({
    frame: frame - delay,
    fps,
    config: SPRING.soft,
  });

  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(progress, [0, 1], [16, 0]);
  const ringScale = interpolate(progress, [0, 1], [0.7, 1]);
  const accentColor =
    accent === 'blue' ? COLORS.blue600 : COLORS.emerald400;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity,
        transform: `translateY(${translateY}px)`,
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: -18,
          top: -18,
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: `2px solid ${accentColor}`,
          boxShadow: `0 0 24px ${COLORS.glowEmerald}`,
          transform: `scale(${ringScale})`,
        }}
      />
      <div
        style={{
          marginLeft: 28,
          marginTop: -6,
          maxWidth: 320,
          padding: '12px 16px',
          borderRadius: 12,
          backgroundColor: COLORS.calloutBg,
          border: `1px solid ${COLORS.calloutBorder}`,
          color: COLORS.zinc50,
          fontFamily: FONTS.sans,
          fontSize: TYPOGRAPHY.callout,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          lineHeight: 1.25,
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        }}
      >
        {text}
      </div>
    </div>
  );
};

type HighlightRingProps = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly delay?: number;
};

export const HighlightRing: React.FC<HighlightRingProps> = ({
  x,
  y,
  width,
  height,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: SPRING.gentle,
  });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const scale = interpolate(progress, [0, 1], [0.96, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        borderRadius: 14,
        border: `2px solid ${COLORS.emerald400}`,
        boxShadow: `0 0 0 6px ${COLORS.glowEmerald}, 0 0 40px ${COLORS.glowEmerald}`,
        opacity,
        transform: `scale(${scale})`,
        pointerEvents: 'none',
        zIndex: 15,
      }}
    />
  );
};
