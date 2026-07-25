import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { AnimatedCursor } from './AnimatedCursor';
import { BrowserChrome } from './BrowserChrome';
import { GradientBackground } from './GradientBackground';
import { SceneCaption } from './SceneCaption';
import { captureSrc, type CaptureKey } from '../config/assets';
import { SAFE_AREA } from '../config/dimensions';

type BrowserStepProps = {
  readonly capture: CaptureKey;
  readonly url: string;
  readonly caption?: { text: string; eyebrow?: string };
  readonly cursorPath?: ReadonlyArray<{ x: number; y: number }>;
  readonly clickAt?: number;
  readonly scale?: number;
};

/** Single browser mockup beat used by signup tutorials. */
export const BrowserStep: React.FC<BrowserStepProps> = ({
  capture,
  url,
  caption,
  cursorPath,
  clickAt,
  scale = 0.9,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const opacity = interpolate(
    frame,
    [0, 10, durationInFrames - 10, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const kenBurns = interpolate(frame, [0, durationInFrames], [1, 1.035], {
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <GradientBackground variant="deep" />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: `${SAFE_AREA.vertical}px ${SAFE_AREA.horizontal}px`,
        }}
      >
        <div style={{ position: 'relative', transform: `scale(${kenBurns})` }}>
          <BrowserChrome url={url} scale={scale}>
            <Img
              src={captureSrc(capture)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center top',
              }}
            />
            {cursorPath ? (
              <AnimatedCursor
                path={cursorPath}
                startFrame={8}
                durationInFrames={Math.max(
                  36,
                  Math.floor(durationInFrames * 0.55),
                )}
                clickingAt={clickAt ? [clickAt] : []}
              />
            ) : null}
          </BrowserChrome>
        </div>
      </div>
      {caption ? (
        <SceneCaption
          text={caption.text}
          eyebrow={caption.eyebrow}
          delay={10}
        />
      ) : null}
    </AbsoluteFill>
  );
};
