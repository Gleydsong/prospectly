import React from 'react';
import { Composition, Folder, Still } from 'remotion';

import { VIDEO } from './config/dimensions';
import { PRICING_VIDEO_DURATION } from './config/pricing-timing';
import {
  CREATE_FREE_ACCOUNT_DURATION,
  HOW_TO_CREATE_ACCOUNT_DURATION,
} from './config/signup-timing';
import { DEMO_EXTRA_FRAMES, PROMO_DURATION_IN_FRAMES, SCENE_FRAMES } from './config/timing';
import { CreateFreeAccount } from './CreateFreeAccount';
import { HowToCreateAccount } from './HowToCreateAccount';
import { PricingPromo } from './PricingPromo';
import { ProspectlyPromo } from './ProspectlyPromo';
import { SocialCarousel } from './SocialCarousel';
import {
  TestDemo,
  TestIntro,
  TestLanding,
  TestOutro,
} from './test-compositions';

import './index.css';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ProspectlyPromo"
        component={ProspectlyPromo}
        durationInFrames={PROMO_DURATION_IN_FRAMES}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          productUrl: 'prospectly.dev',
        }}
      />

      <Composition
        id="HowToCreateAccount"
        component={HowToCreateAccount}
        durationInFrames={HOW_TO_CREATE_ACCOUNT_DURATION}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          productUrl: 'prospectly.dev',
        }}
      />

      <Composition
        id="CreateFreeAccount"
        component={CreateFreeAccount}
        durationInFrames={CREATE_FREE_ACCOUNT_DURATION}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          productUrl: 'prospectly.dev',
        }}
      />

      <Composition
        id="PricingPromo"
        component={PricingPromo}
        durationInFrames={PRICING_VIDEO_DURATION}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          productUrl: 'prospectly.dev',
        }}
      />

      <Composition
        id="SocialCarousel"
        component={SocialCarousel}
        durationInFrames={8}
        fps={1}
        width={1080}
        height={1350}
      />

      <Folder name="Test-Scenes">
        <Composition
          id="Test-Intro"
          component={TestIntro}
          durationInFrames={SCENE_FRAMES.intro}
          fps={VIDEO.fps}
          width={VIDEO.width}
          height={VIDEO.height}
        />
        <Composition
          id="Test-Landing"
          component={TestLanding}
          durationInFrames={SCENE_FRAMES.landing}
          fps={VIDEO.fps}
          width={VIDEO.width}
          height={VIDEO.height}
        />
        <Composition
          id="Test-Demo"
          component={TestDemo}
          durationInFrames={SCENE_FRAMES.demo + DEMO_EXTRA_FRAMES}
          fps={VIDEO.fps}
          width={VIDEO.width}
          height={VIDEO.height}
        />
        <Composition
          id="Test-Outro"
          component={TestOutro}
          durationInFrames={SCENE_FRAMES.outro}
          fps={VIDEO.fps}
          width={VIDEO.width}
          height={VIDEO.height}
        />
        <Still
          id="Still-Intro"
          component={TestIntro}
          width={VIDEO.width}
          height={VIDEO.height}
        />
      </Folder>
    </>
  );
};
