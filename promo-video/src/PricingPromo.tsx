import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';

import { PRICING_VIDEO_FRAMES } from './config/pricing-timing';
import { IntroScene } from './scenes/IntroScene';
import { OutroScene } from './scenes/OutroScene';
import {
  CurrenciesScene,
  FreeHookScene,
  LifetimePriceScene,
  MonthlyPriceScene,
} from './scenes/PricingScenes';

type PricingPromoProps = {
  readonly productUrl: string;
};

export const PricingPromo: React.FC<PricingPromoProps> = ({ productUrl }) => {
  const t = PRICING_VIDEO_FRAMES.transition;
  void productUrl;

  return (
    <AbsoluteFill style={{ backgroundColor: '#09090b' }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={PRICING_VIDEO_FRAMES.intro}>
          <IntroScene
            title="Preços claros"
            subtitle="Um plano Starter. Mensal ou vitalício."
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: t })}
        />
        <TransitionSeries.Sequence
          durationInFrames={PRICING_VIDEO_FRAMES.freeHook}
        >
          <FreeHookScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: t })}
        />
        <TransitionSeries.Sequence
          durationInFrames={PRICING_VIDEO_FRAMES.monthly}
        >
          <MonthlyPriceScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: t })}
        />
        <TransitionSeries.Sequence
          durationInFrames={PRICING_VIDEO_FRAMES.lifetime}
        >
          <LifetimePriceScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: t })}
        />
        <TransitionSeries.Sequence
          durationInFrames={PRICING_VIDEO_FRAMES.currencies}
        >
          <CurrenciesScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: t })}
        />
        <TransitionSeries.Sequence durationInFrames={PRICING_VIDEO_FRAMES.outro}>
          <OutroScene
            headline="Escolha o plano e comece hoje"
            buttonLabel="Ver preços"
            url="prospectly.dev/precos"
          />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
