import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';

import { DEMO_EXTRA_FRAMES, SCENE_FRAMES } from './config/timing';
import { DemoScene } from './scenes/DemoScene';
import { IntroScene } from './scenes/IntroScene';
import { LandingScene } from './scenes/LandingScene';
import { OutroScene } from './scenes/OutroScene';

type ProspectlyPromoProps = {
  readonly productUrl: string;
};

export const ProspectlyPromo: React.FC<ProspectlyPromoProps> = ({
  productUrl,
}) => {
  const transition = SCENE_FRAMES.transition;
  // productUrl is Studio-editable; scenes use PRODUCT.url defaults today.
  void productUrl;

  return (
    <AbsoluteFill style={{ backgroundColor: '#09090b' }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.intro}>
          <IntroScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transition })}
        />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.landing}>
          <LandingScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transition })}
        />
        <TransitionSeries.Sequence
          durationInFrames={SCENE_FRAMES.demo + DEMO_EXTRA_FRAMES}
        >
          <DemoScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transition })}
        />
        <TransitionSeries.Sequence durationInFrames={SCENE_FRAMES.outro}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
