import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { SPRING } from '../config/timing';
import { COLORS, FONTS, PRODUCT, TYPOGRAPHY } from '../config/theme';

type LogoProps = {
  readonly size?: 'hero' | 'compact';
  readonly showWordmark?: boolean;
};

export const Logo: React.FC<LogoProps> = ({
  size = 'hero',
  showWordmark = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: SPRING.gentle,
  });

  const scale = interpolate(enter, [0, 1], [0.86, 1]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const markSize = size === 'hero' ? 88 : 48;
  const fontSize = size === 'hero' ? TYPOGRAPHY.hero : TYPOGRAPHY.headline;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          width: markSize,
          height: markSize,
          borderRadius: markSize * 0.28,
          background: `linear-gradient(145deg, ${COLORS.emerald500}, ${COLORS.emerald600})`,
          boxShadow: `0 0 48px ${COLORS.glowEmerald}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width={markSize * 0.55}
          height={markSize * 0.55}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" stroke={COLORS.white} strokeWidth="2" />
          <path
            d="M16.5 16.5L21 21"
            stroke={COLORS.white}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {showWordmark ? (
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            color: COLORS.zinc50,
            lineHeight: 1,
          }}
        >
          {PRODUCT.name}
        </div>
      ) : null}
    </div>
  );
};

export const LogoMark: React.FC = () => (
  <AbsoluteFill
    style={{
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <Logo />
  </AbsoluteFill>
);
