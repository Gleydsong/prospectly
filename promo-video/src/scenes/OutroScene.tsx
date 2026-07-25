import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { GradientBackground } from '../components/GradientBackground';
import { Logo } from '../components/Logo';
import { SAFE_AREA } from '../config/dimensions';
import { SPRING } from '../config/timing';
import { COLORS, FONTS, PRODUCT, TYPOGRAPHY } from '../config/theme';

type OutroSceneProps = {
  readonly headline?: string;
  readonly buttonLabel?: string;
  readonly url?: string;
};

export const OutroScene: React.FC<OutroSceneProps> = ({
  headline = PRODUCT.cta,
  buttonLabel = 'Criar conta',
  url = PRODUCT.url,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ctaProgress = spring({
    frame: frame - 0.8 * fps,
    fps,
    config: SPRING.gentle,
  });
  const ctaOpacity = interpolate(ctaProgress, [0, 1], [0, 1]);
  const ctaY = interpolate(ctaProgress, [0, 1], [20, 0]);

  const urlOpacity = interpolate(frame, [1.6 * fps, 2.2 * fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill>
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
            gap: 32,
            textAlign: 'center',
          }}
        >
          <Logo size="hero" />
          <div
            style={{
              opacity: ctaOpacity,
              transform: `translateY(${ctaY}px)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <p
              style={{
                margin: 0,
                maxWidth: 800,
                fontFamily: FONTS.display,
                fontSize: TYPOGRAPHY.cta,
                fontWeight: 700,
                color: COLORS.zinc50,
                letterSpacing: '-0.03em',
              }}
            >
              {headline}
            </p>
            <div
              style={{
                padding: '16px 36px',
                borderRadius: 14,
                backgroundColor: COLORS.blue600,
                color: COLORS.white,
                fontFamily: FONTS.sans,
                fontSize: TYPOGRAPHY.supporting,
                fontWeight: 650,
                boxShadow: `0 16px 48px rgba(37, 99, 235, 0.35)`,
              }}
            >
              {buttonLabel}
            </div>
            <p
              style={{
                margin: 0,
                opacity: urlOpacity,
                fontFamily: FONTS.sans,
                fontSize: TYPOGRAPHY.url,
                fontWeight: 600,
                color: COLORS.emerald400,
                letterSpacing: '-0.02em',
              }}
            >
              {url}
            </p>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
