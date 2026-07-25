import React from 'react';
import { AbsoluteFill } from 'remotion';

import { COLORS } from '../config/theme';

type GradientBackgroundProps = {
  readonly variant?: 'dark' | 'deep';
};

export const GradientBackground: React.FC<GradientBackgroundProps> = ({
  variant = 'dark',
}) => {
  const base = variant === 'deep' ? COLORS.ink : COLORS.zinc950;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: base,
        backgroundImage: `
          radial-gradient(ellipse 70% 50% at 50% 0%, ${COLORS.glowEmerald}, transparent 60%),
          radial-gradient(ellipse 40% 40% at 85% 80%, rgba(37, 99, 235, 0.12), transparent 55%),
          linear-gradient(180deg, ${COLORS.zinc950} 0%, ${COLORS.ink} 100%)
        `,
      }}
    />
  );
};
