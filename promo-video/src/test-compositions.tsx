import React from 'react';
import { AbsoluteFill } from 'remotion';

import { DemoScene } from './scenes/DemoScene';
import { IntroScene } from './scenes/IntroScene';
import { LandingScene } from './scenes/LandingScene';
import { OutroScene } from './scenes/OutroScene';

const Frame: React.FC<{ readonly children: React.ReactNode }> = ({
  children,
}) => (
  <AbsoluteFill style={{ backgroundColor: '#09090b' }}>{children}</AbsoluteFill>
);

export const TestIntro: React.FC = () => (
  <Frame>
    <IntroScene />
  </Frame>
);

export const TestLanding: React.FC = () => (
  <Frame>
    <LandingScene />
  </Frame>
);

export const TestDemo: React.FC = () => (
  <Frame>
    <DemoScene />
  </Frame>
);

export const TestOutro: React.FC = () => (
  <Frame>
    <OutroScene />
  </Frame>
);
