'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Buildings,
  Check,
  CheckCircle,
  Funnel,
  ListChecks,
  MapPin,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';

type ProductDemoVideoProps = {
  locale: 'pt' | 'en';
  className?: string;
};

const VIDEO_SRC = '/videos/product-demo-flow.mp4';
const POSTER_SRC = '/videos/product-demo-flow-poster.png';

export function ProductDemoVideo({ locale, className }: ProductDemoVideoProps) {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const preferVideo = reduceMotion !== true && !videoFailed;

  useEffect(() => {
    if (!preferVideo) return;
    const el = videoRef.current;
    if (!el) return;
    void el.play().then(() => setVideoReady(true)).catch(() => setVideoFailed(true));
  }, [preferVideo]);

  const ariaLabel =
    locale === 'pt'
      ? 'Demonstração animada do fluxo claro do Prospectly'
      : 'Animated preview of Prospectly’s clear workflow';

  if (!preferVideo) {
    return <ProductDemoFallback locale={locale} className={className} ariaLabel={ariaLabel} />;
  }

  return (
    <div
      className={['product-demo-motion', 'product-demo-motion--video', className]
        .filter(Boolean)
        .join(' ')}
      role="img"
      aria-label={ariaLabel}
    >
      {!videoReady ? (
        <ProductDemoFallback locale={locale} className="absolute inset-0" ariaLabel={ariaLabel} />
      ) : null}
      <video
        ref={videoRef}
        className="product-demo-motion-video"
        src={VIDEO_SRC}
        poster={POSTER_SRC}
        muted
        playsInline
        loop
        autoPlay
        preload="auto"
        onPlaying={() => setVideoReady(true)}
        onError={() => setVideoFailed(true)}
        aria-hidden
        style={{ opacity: videoReady ? 1 : 0 }}
      />
    </div>
  );
}

function ProductDemoFallback({
  locale,
  className,
  ariaLabel,
}: ProductDemoVideoProps & { ariaLabel: string }) {
  const reduceMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => {
      setActiveStep((step) => (step + 1) % 3);
    }, 3600);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  const steps = [
    { label: locale === 'pt' ? 'Defina' : 'Define', title: locale === 'pt' ? 'Escolha seu foco' : 'Choose your focus', icon: Funnel },
    { label: locale === 'pt' ? 'Encontre' : 'Find', title: locale === 'pt' ? 'Receba oportunidades' : 'Get opportunities', icon: MagnifyingGlass },
    { label: locale === 'pt' ? 'Organize' : 'Organize', title: locale === 'pt' ? 'Prepare o próximo passo' : 'Prepare the next step', icon: ListChecks },
  ] as const;
  const current = steps[activeStep];

  return (
    <div
      className={['product-demo-motion', className].filter(Boolean).join(' ')}
      role="img"
      aria-label={ariaLabel}
    >
      <div className="product-demo-motion-glow" aria-hidden="true" />
      <div className="product-demo-motion-topbar">
        <span className="product-demo-motion-brand">
          prospectly<span>.</span>
        </span>
        <span className="product-demo-motion-status">
          <i /> {locale === 'pt' ? 'Fluxo de prospecção' : 'Prospecting flow'}
        </span>
      </div>
      <div className="product-demo-motion-progress" aria-hidden="true">
        <motion.i animate={{ scaleX: (activeStep + 1) / steps.length }} transition={{ duration: 0.45 }} />
      </div>
      <div className="product-demo-motion-heading">
        <div>
          <span className="product-demo-motion-eyebrow">
            0{activeStep + 1} · {current.label.toUpperCase()}
          </span>
          <h3>{current.title}</h3>
        </div>
        <span className="product-demo-motion-count">0{activeStep + 1} / 03</span>
      </div>
      <AnimatePresence mode="wait" initial={!reduceMotion}>
        <motion.div
          key={activeStep}
          className="product-demo-motion-screen"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
        >
          {activeStep === 0 ? <ProfileStep locale={locale} /> : null}
          {activeStep === 1 ? <ResultsStep locale={locale} /> : null}
          {activeStep === 2 ? <OrganizeStep locale={locale} /> : null}
        </motion.div>
      </AnimatePresence>
      <div className="product-demo-motion-tabs" role="tablist" aria-label={locale === 'pt' ? 'Etapas do fluxo' : 'Flow steps'}>
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <button
              key={step.label}
              type="button"
              role="tab"
              aria-selected={activeStep === index}
              onClick={() => setActiveStep(index)}
            >
              <Icon weight="bold" aria-hidden /> {step.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProfileStep({ locale }: { locale: 'pt' | 'en' }) {
  return (
    <div className="product-demo-fields">
      <div className="product-demo-field">
        <span>{locale === 'pt' ? 'Segmento' : 'Segment'}</span>
        <strong>
          <Buildings weight="bold" aria-hidden />{' '}
          {locale === 'pt' ? 'Clínicas odontológicas' : 'Dental clinics'}
        </strong>
      </div>
      <div className="product-demo-field">
        <span>{locale === 'pt' ? 'Localização' : 'Location'}</span>
        <strong>
          <MapPin weight="bold" aria-hidden /> Curitiba, PR
        </strong>
      </div>
      <div className="product-demo-filter">
        <Funnel weight="bold" aria-hidden />{' '}
        {locale === 'pt' ? 'Sem website reportado' : 'No website reported'}{' '}
        <Check weight="bold" aria-hidden />
      </div>
      <div className="product-demo-action">
        {locale === 'pt' ? 'Continuar' : 'Continue'} <ArrowRight weight="bold" aria-hidden />
      </div>
    </div>
  );
}

function ResultsStep({ locale }: { locale: 'pt' | 'en' }) {
  return (
    <div className="product-demo-results">
      <div className="product-demo-result-summary">
        <span>
          <MagnifyingGlass weight="bold" aria-hidden />{' '}
          {locale === 'pt' ? '18 empresas encontradas' : '18 businesses found'}
        </span>
        <strong>{locale === 'pt' ? '3 selecionadas' : '3 selected'}</strong>
      </div>
      {['Clínica Centro Sul', 'Odonto Bairro Alto', 'Smile Estação'].map((name, index) => (
        <div className="product-demo-result-row" key={name}>
          <span className="product-demo-check">
            <Check weight="bold" aria-hidden />
          </span>
          <strong>{name}</strong>
          <small>
            {[92, 88, 84][index]}% {locale === 'pt' ? 'alinhamento' : 'fit'}
          </small>
        </div>
      ))}
    </div>
  );
}

function OrganizeStep({ locale }: { locale: 'pt' | 'en' }) {
  const tasks =
    locale === 'pt'
      ? ['Revisar presença digital', 'Criar diagnóstico', 'Preparar abordagem']
      : ['Review digital presence', 'Create diagnosis', 'Prepare outreach'];

  return (
    <div className="product-demo-organize">
      <div className="product-demo-organize-head">
        <span>{locale === 'pt' ? 'Lista qualificada' : 'Qualified list'}</span>
        <strong>3 leads</strong>
      </div>
      {tasks.map((task) => (
        <div className="product-demo-task" key={task}>
          <CheckCircle weight="fill" aria-hidden />
          <span>{task}</span>
          <small>{locale === 'pt' ? 'Hoje' : 'Today'}</small>
        </div>
      ))}
      <div className="product-demo-next-step">
        {locale === 'pt' ? 'Próximo passo claro' : 'Clear next step'}{' '}
        <ArrowRight weight="bold" aria-hidden />
      </div>
    </div>
  );
}
