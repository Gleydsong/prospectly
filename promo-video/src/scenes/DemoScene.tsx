import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { AnimatedCursor } from '../components/AnimatedCursor';
import { BrowserChrome } from '../components/BrowserChrome';
import { GradientBackground } from '../components/GradientBackground';
import { SceneCaption } from '../components/SceneCaption';
import { captureSrc, type CaptureKey } from '../config/assets';
import { SAFE_AREA } from '../config/dimensions';
import { DEMO_BEATS, DEMO_EXTRA_FRAMES, SCENE_FRAMES } from '../config/timing';

type DemoBeat = {
  readonly key: CaptureKey;
  readonly from: number;
  readonly duration: number;
  readonly url: string;
  /** Caption only on key product pages. */
  readonly caption?: { text: string; eyebrow?: string };
  readonly cursorPath?: ReadonlyArray<{ x: number; y: number }>;
  readonly clickAt?: number;
};

const DEMO_TOTAL = SCENE_FRAMES.demo + DEMO_EXTRA_FRAMES;

const BEATS: readonly DemoBeat[] = [
  {
    key: 'login',
    from: DEMO_BEATS.loginHold,
    duration: DEMO_BEATS.dashboardHold - DEMO_BEATS.loginHold,
    url: 'https://app.prospectly.dev/login',
    cursorPath: [
      { x: 720, y: 380 },
      { x: 820, y: 430 },
      { x: 820, y: 510 },
      { x: 860, y: 590 },
    ],
    clickAt: 90,
  },
  {
    key: 'dashboard',
    from: DEMO_BEATS.dashboardHold,
    duration: DEMO_BEATS.searchNav - DEMO_BEATS.dashboardHold,
    url: 'https://app.prospectly.dev/',
    cursorPath: [
      { x: 200, y: 280 },
      { x: 180, y: 340 },
    ],
  },
  {
    key: 'search',
    from: DEMO_BEATS.searchNav,
    duration: DEMO_BEATS.searchFill - DEMO_BEATS.searchNav,
    url: 'https://app.prospectly.dev/search',
    caption: { eyebrow: 'Pesquisa', text: 'Encontre negócios locais' },
    cursorPath: [
      { x: 180, y: 340 },
      { x: 520, y: 260 },
    ],
  },
  {
    key: 'searchFilled',
    from: DEMO_BEATS.searchFill,
    duration: DEMO_BEATS.leadsNav - DEMO_BEATS.searchFill,
    url: 'https://app.prospectly.dev/search',
    cursorPath: [
      { x: 520, y: 260 },
      { x: 640, y: 420 },
      { x: 700, y: 560 },
    ],
    clickAt: 70,
  },
  {
    key: 'leads',
    from: DEMO_BEATS.leadsNav,
    duration: DEMO_BEATS.pipelineNav - DEMO_BEATS.leadsNav,
    url: 'https://app.prospectly.dev/leads',
    caption: { eyebrow: 'Leads', text: 'Priorize quem ainda não tem site' },
    cursorPath: [
      { x: 200, y: 400 },
      { x: 700, y: 320 },
    ],
  },
  {
    key: 'pipeline',
    from: DEMO_BEATS.pipelineNav,
    duration: DEMO_TOTAL - DEMO_BEATS.pipelineNav,
    url: 'https://app.prospectly.dev/pipeline',
    caption: { eyebrow: 'Pipeline', text: 'Acompanhe cada oportunidade' },
    cursorPath: [
      { x: 400, y: 360 },
      { x: 900, y: 400 },
    ],
  },
] as const;

const DemoBeatView: React.FC<{ readonly beat: DemoBeat }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const opacity = interpolate(
    frame,
    [0, 10, durationInFrames - 10, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const kenBurns = interpolate(frame, [0, durationInFrames], [1, 1.04], {
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  return (
    <AbsoluteFill style={{ opacity }}>
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
          <BrowserChrome url={beat.url} scale={0.9}>
            <Img
              src={captureSrc(beat.key)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'left top',
              }}
            />
            {beat.cursorPath ? (
              <AnimatedCursor
                path={beat.cursorPath}
                startFrame={8}
                durationInFrames={Math.max(
                  36,
                  Math.floor(durationInFrames * 0.55),
                )}
                clickingAt={beat.clickAt ? [beat.clickAt] : []}
              />
            ) : null}
          </BrowserChrome>
        </div>
      </div>
      {beat.caption ? (
        <SceneCaption
          text={beat.caption.text}
          eyebrow={beat.caption.eyebrow}
          delay={12}
        />
      ) : null}
    </AbsoluteFill>
  );
};

export const DemoScene: React.FC = () => {
  return (
    <AbsoluteFill>
      <GradientBackground variant="deep" />
      {BEATS.map((beat) => (
        <Sequence
          key={beat.key}
          from={Math.round(beat.from)}
          durationInFrames={Math.round(beat.duration)}
          layout="none"
        >
          <DemoBeatView beat={beat} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
