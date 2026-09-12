'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import {
  Check,
  CheckCircle,
  Funnel,
  MagnifyingGlass,
  MapPin,
} from '@phosphor-icons/react';

const JOURNEY_STATES = [
  {
    label: 'Defina',
    eyebrow: '01 · PERFIL IDEAL',
    title: 'Comece pelo cliente que faz sentido.',
    description: 'Escolha uma categoria e uma cidade. A busca começa com uma intenção clara.',
  },
  {
    label: 'Encontre',
    eyebrow: '02 · OPORTUNIDADES',
    title: 'Veja empresas que podem valorizar seu trabalho.',
    description: 'Receba resultados organizados, com sinais para decidir por onde começar.',
  },
  {
    label: 'Organize',
    eyebrow: '03 · PRÓXIMO PASSO',
    title: 'Transforme a lista em conversa.',
    description: 'Revise, crie tarefas e mantenha o contexto até a primeira abordagem.',
  },
] as const;

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.dataset.motionReady = 'true';
    if (reduced) {
      element.classList.add('is-visible');
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      element.classList.add('is-visible');
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          element.classList.add('is-visible');
          observer.disconnect();
        }
      },
      { threshold: 0.16 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [reduced]);

  return ref;
}

export function MotionReveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`landing-how-reveal ${className}`} style={{ '--how-delay': `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

export function RevealedListItem({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useReveal<HTMLLIElement>();
  return (
    <li ref={ref} className={`landing-how-reveal ${className}`} style={{ '--how-delay': `${delay}ms` } as CSSProperties}>
      {children}
    </li>
  );
}

function JourneyScreen({ active }: { active: number }) {
  if (active === 0) {
    return (
      <div className="landing-how-screen-content landing-how-fields-screen">
        <div className="landing-how-mock-field">
          <span>Categoria</span>
          <strong>Clínicas odontológicas</strong>
        </div>
        <div className="landing-how-mock-field">
          <span>
            <MapPin weight="bold" aria-hidden /> Cidade
          </span>
          <strong>Curitiba, PR</strong>
        </div>
        <div className="landing-how-mock-toggle">
          <span>
            <Funnel weight="bold" aria-hidden /> Sem website reportado
          </span>
          <i aria-hidden />
        </div>
      </div>
    );
  }
  if (active === 1) {
    return (
      <div className="landing-how-screen-content landing-how-results-screen">
        <div className="landing-how-result-summary">
          <span>
            <MagnifyingGlass weight="bold" aria-hidden /> 18 empresas encontradas
          </span>
          <small>3 selecionadas</small>
        </div>
        {['Clínica Centro Sul', 'Odonto Bairro Alto', 'Smile Estação'].map((company, index) => (
          <div className="landing-how-result-row" key={company}>
            <span className="landing-how-result-check">
              <Check weight="bold" aria-hidden />
            </span>
            <strong>{company}</strong>
            <span className="landing-how-score">{[92, 88, 84][index]}%</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="landing-how-screen-content landing-how-list-screen">
      <div className="landing-how-list-heading">
        <span>Lista qualificada</span>
        <strong>3 leads</strong>
      </div>
      {['Revisar presença digital', 'Criar diagnóstico', 'Preparar abordagem'].map((task) => (
        <div className="landing-how-task-row" key={task}>
          <CheckCircle weight="fill" aria-hidden />
          <span>{task}</span>
          <small>Hoje</small>
        </div>
      ))}
    </div>
  );
}

export function JourneyMock() {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % JOURNEY_STATES.length), 3800);
    return () => window.clearInterval(timer);
  }, [reduced]);

  const current = JOURNEY_STATES[active];

  return (
    <div className="landing-how-journey-mock" aria-label="Demonstração interativa do fluxo do Prospectly">
      <div className="landing-how-mock-chrome">
        <span>rospectly</span>
        <small>Fluxo de prospecção</small>
      </div>
      <div className="landing-how-mock-progress" aria-hidden="true">
        <i style={{ transform: `scaleX(${(active + 1) / JOURNEY_STATES.length})` }} />
      </div>
      <div className="landing-how-mock-head">
        <div>
          <small>{current.eyebrow}</small>
          <h3>{current.title}</h3>
        </div>
        <span>{String(active + 1).padStart(2, '0')} / 03</span>
      </div>
      <p className="landing-how-mock-description">{current.description}</p>
      <div key={active} className={`landing-how-mock-screen landing-how-active-${active}`}>
        <JourneyScreen active={active} />
      </div>
      <div className="landing-how-mock-tabs" role="tablist" aria-label="Etapas da demonstração">
        {JOURNEY_STATES.map((step, index) => (
          <button
            key={step.label}
            type="button"
            role="tab"
            aria-selected={active === index}
            onClick={() => setActive(index)}
          >
            {step.label}
          </button>
        ))}
      </div>
    </div>
  );
}
