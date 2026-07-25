import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { GradientBackground } from '../components/GradientBackground';
import { Logo } from '../components/Logo';
import { SAFE_AREA } from '../config/dimensions';
import { COLORS, FONTS, PRODUCT, TYPOGRAPHY } from '../config/theme';

type IntroSceneProps = {
  readonly title?: string;
  readonly subtitle?: string;
};

export const IntroScene: React.FC<IntroSceneProps> = ({
  title = PRODUCT.name,
  subtitle = PRODUCT.tagline,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const taglineOpacity = interpolate(frame, [0.9 * fps, 1.6 * fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const taglineY = interpolate(frame, [0.9 * fps, 1.6 * fps], [18, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const showCustomTitle = title !== PRODUCT.name;

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <GradientBackground />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: `${SAFE_AREA.vertical}px ${SAFE_AREA.horizontal}px`,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 28,
            textAlign: 'center',
          }}
        >
          <Logo size="hero" showWordmark={!showCustomTitle} />
          {showCustomTitle ? (
            <h1
              style={{
                margin: 0,
                maxWidth: 900,
                fontFamily: FONTS.display,
                fontSize: TYPOGRAPHY.headline,
                fontWeight: 700,
                letterSpacing: '-0.04em',
                color: COLORS.zinc50,
                lineHeight: 1.1,
              }}
            >
              {title}
            </h1>
          ) : null}
          <p
            style={{
              margin: 0,
              maxWidth: 720,
              opacity: taglineOpacity,
              transform: `translateY(${taglineY}px)`,
              fontFamily: FONTS.sans,
              fontSize: TYPOGRAPHY.supporting,
              fontWeight: 500,
              color: COLORS.zinc300,
              letterSpacing: '-0.02em',
              lineHeight: 1.35,
            }}
          >
            {subtitle}
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
