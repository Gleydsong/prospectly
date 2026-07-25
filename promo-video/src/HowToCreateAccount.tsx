import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';

import { BrowserStep } from './components/BrowserStep';
import { HOW_TO_CREATE_ACCOUNT_FRAMES } from './config/signup-timing';
import { IntroScene } from './scenes/IntroScene';
import { OutroScene } from './scenes/OutroScene';

type HowToCreateAccountProps = {
  readonly productUrl: string;
};

export const HowToCreateAccount: React.FC<HowToCreateAccountProps> = ({
  productUrl,
}) => {
  const t = HOW_TO_CREATE_ACCOUNT_FRAMES.transition;
  void productUrl;

  return (
    <AbsoluteFill style={{ backgroundColor: '#09090b' }}>
      <TransitionSeries>
        <TransitionSeries.Sequence
          durationInFrames={HOW_TO_CREATE_ACCOUNT_FRAMES.intro}
        >
          <IntroScene
            title="Como criar sua conta"
            subtitle="Cadastro em poucos passos no Prospectly"
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: t })}
        />
        <TransitionSeries.Sequence
          durationInFrames={HOW_TO_CREATE_ACCOUNT_FRAMES.registerEmpty}
        >
          <BrowserStep
            capture="registerEmpty"
            url="https://app.prospectly.dev/register"
            caption={{ eyebrow: 'Passo 1', text: 'Abra a página de cadastro' }}
            cursorPath={[
              { x: 780, y: 280 },
              { x: 820, y: 340 },
            ]}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: t })}
        />
        <TransitionSeries.Sequence
          durationInFrames={HOW_TO_CREATE_ACCOUNT_FRAMES.registerFilled}
        >
          <BrowserStep
            capture="registerFilled"
            url="https://app.prospectly.dev/register"
            caption={{
              eyebrow: 'Passo 2',
              text: 'Preencha nome, e-mail e organização',
            }}
            cursorPath={[
              { x: 820, y: 340 },
              { x: 820, y: 420 },
              { x: 820, y: 500 },
              { x: 860, y: 680 },
            ]}
            clickAt={100}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: t })}
        />
        <TransitionSeries.Sequence
          durationInFrames={HOW_TO_CREATE_ACCOUNT_FRAMES.dashboard}
        >
          <BrowserStep
            capture="dashboard"
            url="https://app.prospectly.dev/"
            caption={{ eyebrow: 'Pronto', text: 'Sua conta já está ativa' }}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: t })}
        />
        <TransitionSeries.Sequence
          durationInFrames={HOW_TO_CREATE_ACCOUNT_FRAMES.outro}
        >
          <OutroScene
            headline="Crie sua conta em minutos"
            buttonLabel="Criar conta"
            url="prospectly.dev"
          />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
