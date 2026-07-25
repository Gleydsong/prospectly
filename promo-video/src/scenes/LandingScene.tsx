import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { BrowserChrome } from '../components/BrowserChrome';
import { GradientBackground } from '../components/GradientBackground';
import { SceneCaption } from '../components/SceneCaption';
import { captureSrc } from '../config/assets';
import { SAFE_AREA } from '../config/dimensions';

export const LandingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const cameraScale = interpolate(frame, [0, durationInFrames], [1, 1.08], {
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });
  const cameraY = interpolate(frame, [0, durationInFrames], [0, -36], {
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

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
        <div
          style={{
            transform: `scale(${cameraScale}) translateY(${cameraY}px)`,
          }}
        >
          <BrowserChrome url="https://prospectly.dev" scale={0.92}>
            <Img
              src={captureSrc('landingHero')}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center top',
              }}
            />
          </BrowserChrome>
        </div>
      </AbsoluteFill>
      <SceneCaption
        eyebrow="Produto"
        text="Prospecção local, do Maps ao pipeline"
        delay={14}
      />
    </AbsoluteFill>
  );
};
