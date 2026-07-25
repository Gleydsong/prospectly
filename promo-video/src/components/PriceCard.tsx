import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { SPRING } from '../config/timing';
import { COLORS, FONTS, TYPOGRAPHY } from '../config/theme';

type PriceCardProps = {
  readonly planLabel: string;
  readonly price: string;
  readonly suffix: string;
  readonly features: readonly string[];
  readonly accent?: 'emerald' | 'blue';
  readonly badge?: string;
  readonly delay?: number;
};

export const PriceCard: React.FC<PriceCardProps> = ({
  planLabel,
  price,
  suffix,
  features,
  accent = 'emerald',
  badge,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accentColor =
    accent === 'blue' ? COLORS.blue600 : COLORS.emerald500;

  const enter = spring({
    frame: frame - delay,
    fps,
    config: SPRING.gentle,
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const scale = interpolate(enter, [0, 1], [0.92, 1]);
  const y = interpolate(enter, [0, 1], [28, 0]);

  const priceEnter = spring({
    frame: frame - delay - 8,
    fps,
    config: SPRING.soft,
  });
  const priceScale = interpolate(priceEnter, [0, 1], [0.85, 1]);

  return (
    <div
      style={{
        width: 720,
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
        borderRadius: 28,
        padding: '40px 48px',
        background: `linear-gradient(165deg, ${COLORS.zinc900} 0%, ${COLORS.ink} 100%)`,
        border: `1px solid rgba(255,255,255,0.08)`,
        boxShadow: `
          0 40px 100px rgba(0,0,0,0.45),
          0 0 0 1px rgba(255,255,255,0.04),
          0 0 80px ${accent === 'emerald' ? COLORS.glowEmerald : 'rgba(37,99,235,0.25)'}
        `,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 28,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: accentColor,
          }}
        >
          {planLabel}
        </span>
        {badge ? (
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 16,
              fontWeight: 600,
              color: COLORS.zinc50,
              backgroundColor: accentColor,
              padding: '8px 14px',
              borderRadius: 999,
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          transform: `scale(${priceScale})`,
          transformOrigin: 'left center',
        }}
      >
        <span
          style={{
            fontFamily: FONTS.display,
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: '-0.05em',
            color: COLORS.zinc50,
            lineHeight: 1,
          }}
        >
          {price}
        </span>
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: TYPOGRAPHY.label,
            fontWeight: 500,
            color: COLORS.zinc400,
          }}
        >
          {suffix}
        </span>
      </div>

      <ul
        style={{
          listStyle: 'none',
          margin: '36px 0 0',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {features.map((feature, index) => {
          const featureProgress = spring({
            frame: frame - delay - 18 - index * 5,
            fps,
            config: SPRING.soft,
          });
          const featureOpacity = interpolate(featureProgress, [0, 1], [0, 1]);
          const featureX = interpolate(featureProgress, [0, 1], [16, 0]);

          return (
            <li
              key={feature}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                opacity: featureOpacity,
                transform: `translateX(${featureX}px)`,
                fontFamily: FONTS.sans,
                fontSize: 26,
                fontWeight: 500,
                color: COLORS.zinc300,
                letterSpacing: '-0.02em',
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: `${accentColor}33`,
                  color: accentColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              {feature}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
