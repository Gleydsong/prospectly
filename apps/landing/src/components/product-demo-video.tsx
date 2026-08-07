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
import { useEffect, useState } from 'react';

type ProductDemoVideoProps = {
  locale: 'pt' | 'en';
  className?: string;
};

export function ProductDemoVideo({ locale, className }: ProductDemoVideoProps) {
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
    { label: 'Defina', title: 'Escolha seu foco', icon: Funnel },
    { label: 'Encontre', title: 'Receba oportunidades', icon: MagnifyingGlass },
    { label: 'Organize', title: 'Prepare o próximo passo', icon: ListChecks },
  ] as const;
  const current = steps[activeStep];

  return (
    <div
      className={["product-demo-motion", className].filter(Boolean).join(' ')}
      role="img"
      aria-label={
        locale === 'pt'
          ? 'Demonstração animada do fluxo claro do Prospectly'
          : 'Animated preview of Prospectly’s clear workflow'
      }
    >
      <div className="product-demo-motion-glow" aria-hidden="true" />
      <div className="product-demo-motion-topbar">
        <span className="product-demo-motion-brand">prospectly<span>.</span></span>
        <span className="product-demo-motion-status"><i /> Fluxo de prospecção</span>
      </div>
      <div className="product-demo-motion-progress" aria-hidden="true">
        <motion.i animate={{ scaleX: (activeStep + 1) / steps.length }} transition={{ duration: 0.45 }} />
      </div>
      <div className="product-demo-motion-heading">
        <div>
          <span className="product-demo-motion-eyebrow">0{activeStep + 1} · {current.label.toUpperCase()}</span>
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
          {activeStep === 0 ? <ProfileStep /> : null}
          {activeStep === 1 ? <ResultsStep /> : null}
          {activeStep === 2 ? <OrganizeStep /> : null}
        </motion.div>
      </AnimatePresence>
      <div className="product-demo-motion-tabs" role="tablist" aria-label="Etapas do fluxo">
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

function ProfileStep() {
  return <div className="product-demo-fields">
    <div className="product-demo-field"><span>Segmento</span><strong><Buildings weight="bold" aria-hidden /> Clínicas odontológicas</strong></div>
    <div className="product-demo-field"><span>Localização</span><strong><MapPin weight="bold" aria-hidden /> Curitiba, PR</strong></div>
    <div className="product-demo-filter"><Funnel weight="bold" aria-hidden /> Sem website reportado <Check weight="bold" aria-hidden /></div>
    <div className="product-demo-action">Continuar <ArrowRight weight="bold" aria-hidden /></div>
  </div>;
}

function ResultsStep() {
  return <div className="product-demo-results">
    <div className="product-demo-result-summary"><span><MagnifyingGlass weight="bold" aria-hidden /> 18 empresas encontradas</span><strong>3 selecionadas</strong></div>
    {['Clínica Centro Sul', 'Odonto Bairro Alto', 'Smile Estação'].map((name, index) => <div className="product-demo-result-row" key={name}><span className="product-demo-check"><Check weight="bold" aria-hidden /></span><strong>{name}</strong><small>{[92, 88, 84][index]}% alinhamento</small></div>)}
  </div>;
}

function OrganizeStep() {
  return <div className="product-demo-organize">
    <div className="product-demo-organize-head"><span>Lista qualificada</span><strong>3 leads</strong></div>
    {['Revisar presença digital', 'Criar diagnóstico', 'Preparar abordagem'].map((task) => <div className="product-demo-task" key={task}><CheckCircle weight="fill" aria-hidden /><span>{task}</span><small>Hoje</small></div>)}
    <div className="product-demo-next-step">Próximo passo claro <ArrowRight weight="bold" aria-hidden /></div>
  </div>;
}
