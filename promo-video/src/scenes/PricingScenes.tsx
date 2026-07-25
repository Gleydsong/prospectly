import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { GradientBackground } from '../components/GradientBackground';
import { PriceCard } from '../components/PriceCard';
import { SAFE_AREA } from '../config/dimensions';
import { PRICING } from '../config/pricing';
import { SPRING } from '../config/timing';
import { COLORS, FONTS, TYPOGRAPHY } from '../config/theme';

export const FreeHookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: SPRING.gentle });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const scale = interpolate(enter, [0, 1], [0.9, 1]);

  return (
    <AbsoluteFill>
      <GradientBackground />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: `${SAFE_AREA.vertical}px ${SAFE_AREA.horizontal}px`,
          opacity,
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 24,
              background: `linear-gradient(145deg, ${COLORS.emerald400}, ${COLORS.emerald600})`,
              boxShadow: `0 0 60px ${COLORS.glowEmerald}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              color: COLORS.white,
              fontWeight: 700,
            }}
          >
            3
          </div>
          <p
            style={{
              margin: 0,
              fontFamily: FONTS.display,
              fontSize: TYPOGRAPHY.headline,
              fontWeight: 700,
              letterSpacing: '-0.04em',
              color: COLORS.zinc50,
              maxWidth: 900,
              lineHeight: 1.15,
            }}
          >
            {PRICING.freeHook}
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: FONTS.sans,
              fontSize: TYPOGRAPHY.supporting,
              color: COLORS.zinc400,
              letterSpacing: '-0.02em',
            }}
          >
            Sem cartão. Teste o fluxo completo.
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const MonthlyPriceScene: React.FC = () => {
  return (
    <AbsoluteFill>
      <GradientBackground variant="deep" />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: `${SAFE_AREA.vertical}px ${SAFE_AREA.horizontal}px`,
        }}
      >
        <PriceCard
          planLabel={PRICING.planName}
          price={PRICING.monthly.price}
          suffix={PRICING.monthly.suffix}
          features={PRICING.features}
          badge={PRICING.monthly.label}
          accent="emerald"
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const LifetimePriceScene: React.FC = () => {
  return (
    <AbsoluteFill>
      <GradientBackground variant="deep" />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: `${SAFE_AREA.vertical}px ${SAFE_AREA.horizontal}px`,
        }}
      >
        <PriceCard
          planLabel={PRICING.planName}
          price={PRICING.lifetime.price}
          suffix={PRICING.lifetime.suffix}
          features={PRICING.features}
          badge={PRICING.lifetime.label}
          accent="blue"
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const CurrenciesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
            gap: 40,
            width: '100%',
            maxWidth: 1100,
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: FONTS.display,
              fontSize: TYPOGRAPHY.headline,
              fontWeight: 700,
              letterSpacing: '-0.04em',
              color: COLORS.zinc50,
              textAlign: 'center',
            }}
          >
            BRL, EUR ou USD
          </p>
          <div
            style={{
              display: 'flex',
              gap: 24,
              width: '100%',
              justifyContent: 'center',
            }}
          >
            {PRICING.currencies.map((currency, index) => {
              const enter = spring({
                frame: frame - index * 8,
                fps,
                config: SPRING.gentle,
              });
              const opacity = interpolate(enter, [0, 1], [0, 1]);
              const y = interpolate(enter, [0, 1], [24, 0]);

              return (
                <div
                  key={currency.code}
                  style={{
                    flex: 1,
                    maxWidth: 320,
                    opacity,
                    transform: `translateY(${y}px)`,
                    borderRadius: 22,
                    padding: '28px 24px',
                    backgroundColor: COLORS.zinc900,
                    border: '1px solid rgba(255,255,255,0.08)',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      color: COLORS.emerald400,
                      marginBottom: 16,
                    }}
                  >
                    {currency.code}
                  </div>
                  <div
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: 40,
                      fontWeight: 700,
                      color: COLORS.zinc50,
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {currency.monthly}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: FONTS.sans,
                      fontSize: 18,
                      color: COLORS.zinc400,
                    }}
                  >
                    /mês
                  </div>
                  <div
                    style={{
                      marginTop: 18,
                      paddingTop: 18,
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      fontFamily: FONTS.sans,
                      fontSize: 20,
                      color: COLORS.zinc300,
                    }}
                  >
                    {currency.lifetime} vitalício
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
