import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';

import { BrowserStep } from './components/BrowserStep';
import { CREATE_FREE_ACCOUNT_FRAMES } from './config/signup-timing';
import { IntroScene } from './scenes/IntroScene';
import { OutroScene } from './scenes/OutroScene';

type CreateFreeAccountProps = {
  readonly productUrl: string;
};

export const CreateFreeAccount: React.FC<CreateFreeAccountProps> = ({
  productUrl,
}) => {
  const t = CREATE_FREE_ACCOUNT_FRAMES.transition;
  void productUrl;

  return (
    <AbsoluteFill style={{ backgroundColor: '#09090b' }}>
      <TransitionSeries>
        <TransitionSeries.Sequence
          durationInFrames={CREATE_FREE_ACCOUNT_FRAMES.intro}
        >
          <IntroScene
            title="Conta gratuita"
            subtitle="3 buscas grátis para validar o seu nicho"
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: t })}
        />
        <TransitionSeries.Sequence
          durationInFrames={CREATE_FREE_ACCOUNT_FRAMES.landing}
        >
          <BrowserStep
            capture="landingHero"
            url="https://prospectly.dev"
            caption={{ eyebrow: 'Começar', text: 'Clique em Começar grátis' }}
            cursorPath={[
              { x: 700, y: 520 },
              { x: 760, y: 560 },
            ]}
            clickAt={70}
            scale={0.92}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: t })}
        />
        <TransitionSeries.Sequence
          durationInFrames={CREATE_FREE_ACCOUNT_FRAMES.registerEmpty}
        >
          <BrowserStep
            capture="registerEmpty"
            url="https://app.prospectly.dev/register"
            caption={{
              eyebrow: 'Gratuito',
              text: 'Sem cartão para começar',
            }}
            cursorPath={[
              { x: 780, y: 300 },
              { x: 820, y: 360 },
            ]}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: t })}
        />
        <TransitionSeries.Sequence
          durationInFrames={CREATE_FREE_ACCOUNT_FRAMES.registerFilled}
        >
          <BrowserStep
            capture="registerFilled"
            url="https://app.prospectly.dev/register"
            caption={{
              eyebrow: 'Cadastro',
              text: 'Crie a organização e aceite os termos',
            }}
            cursorPath={[
              { x: 820, y: 360 },
              { x: 820, y: 520 },
              { x: 700, y: 640 },
              { x: 860, y: 720 },
            ]}
            clickAt={110}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: t })}
        />
        <TransitionSeries.Sequence
          durationInFrames={CREATE_FREE_ACCOUNT_FRAMES.success}
        >
          <BrowserStep
            capture="dashboard"
            url="https://app.prospectly.dev/"
            caption={{
              eyebrow: 'Free',
              text: 'Pronto — 3 buscas liberadas',
            }}
          />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: t })}
        />
        <TransitionSeries.Sequence
          durationInFrames={CREATE_FREE_ACCOUNT_FRAMES.outro}
        >
          <OutroScene
            headline="Comece grátis agora"
            buttonLabel="Começar grátis"
            url="prospectly.dev"
          />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
