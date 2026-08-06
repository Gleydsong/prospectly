'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CheckCircle,
  ClipboardText,
  Funnel,
  ListChecks,
  MapPin,
  MagnifyingGlass,
  Target,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { CookieBanner } from '@/components/cookie-banner';
import { V2Footer, V2Header } from '@/components/landing-v2';
import { enterExplainerUrl } from '@/lib/pricing';
import type { Locale } from '@/lib/i18n';

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

const HOW_STEPS = [
  {
    number: '01',
    icon: Target,
    title: 'Defina o cliente ideal',
    body: 'Escolha segmento, cidade e o tipo de empresa que você quer atender. Quanto mais claro o recorte, mais útil fica a lista.',
    action: 'Exemplo: clínicas odontológicas em Curitiba.',
  },
  {
    number: '02',
    icon: Funnel,
    title: 'Filtre com critérios relevantes',
    body: 'Use sinais como website não reportado, localização e categoria para priorizar empresas que merecem uma análise humana.',
    action: 'O mapa informa; você valida antes de abordar.',
  },
  {
    number: '03',
    icon: ListChecks,
    title: 'Organize a lista',
    body: 'Salve leads, acompanhe estágios e crie tarefas. A pesquisa deixa de ficar espalhada em abas e planilhas.',
    action: 'Uma lista boa termina em uma próxima ação.',
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
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        element.classList.add('is-visible');
        observer.disconnect();
      }
    }, { threshold: 0.16 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [reduced]);

  return ref;
}

function MotionReveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useReveal<HTMLDivElement>();
  return <div ref={ref} className={`landing-how-reveal ${className}`} style={{ '--how-delay': `${delay}ms` } as CSSProperties}>{children}</div>;
}

function RevealedListItem({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useReveal<HTMLLIElement>();
  return <li ref={ref} className={`landing-how-reveal ${className}`} style={{ '--how-delay': `${delay}ms` } as CSSProperties}>{children}</li>;
}

function JourneyScreen({ active }: { active: number }) {
  if (active === 0) {
    return <div className="landing-how-screen-content landing-how-fields-screen"><div className="landing-how-mock-field"><span>Categoria</span><strong>Clínicas odontológicas</strong></div><div className="landing-how-mock-field"><span><MapPin weight="bold" aria-hidden /> Cidade</span><strong>Curitiba, PR</strong></div><div className="landing-how-mock-toggle"><span><Funnel weight="bold" aria-hidden /> Sem website reportado</span><i aria-hidden /></div></div>;
  }
  if (active === 1) {
    return <div className="landing-how-screen-content landing-how-results-screen"><div className="landing-how-result-summary"><span><MagnifyingGlass weight="bold" aria-hidden /> 18 empresas encontradas</span><small>3 selecionadas</small></div>{['Clínica Centro Sul', 'Odonto Bairro Alto', 'Smile Estação'].map((company, index) => <div className="landing-how-result-row" key={company}><span className="landing-how-result-check"><Check weight="bold" aria-hidden /></span><strong>{company}</strong><span className="landing-how-score">{[92, 88, 84][index]}%</span></div>)}</div>;
  }
  return <div className="landing-how-screen-content landing-how-list-screen"><div className="landing-how-list-heading"><span>Lista qualificada</span><strong>3 leads</strong></div>{['Revisar presença digital', 'Criar diagnóstico', 'Preparar abordagem'].map((task) => <div className="landing-how-task-row" key={task}><CheckCircle weight="fill" aria-hidden /><span>{task}</span><small>Hoje</small></div>)}</div>;
}

function JourneyMock() {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % JOURNEY_STATES.length), 3800);
    return () => window.clearInterval(timer);
  }, [reduced]);

  const current = JOURNEY_STATES[active];

  return <div className="landing-how-journey-mock" aria-label="Demonstração interativa do fluxo do Prospectly">
    <div className="landing-how-mock-chrome"><span>prospectly<span>.</span></span><small>Fluxo de prospecção</small></div>
    <div className="landing-how-mock-progress" aria-hidden="true"><i style={{ transform: `scaleX(${(active + 1) / JOURNEY_STATES.length})` }} /></div>
    <div className="landing-how-mock-head"><div><small>{current.eyebrow}</small><h3>{current.title}</h3></div><span>{String(active + 1).padStart(2, '0')} / 03</span></div>
    <p className="landing-how-mock-description">{current.description}</p>
    <div key={active} className={`landing-how-mock-screen landing-how-active-${active}`}><JourneyScreen active={active} /></div>
    <div className="landing-how-mock-tabs" role="tablist" aria-label="Etapas da demonstração">
      {JOURNEY_STATES.map((step, index) => <button key={step.label} type="button" role="tab" aria-selected={active === index} onClick={() => setActive(index)}>{step.label}</button>)}
    </div>
  </div>;
}

function HowSteps() {
  return <section id="fluxo" className="landing-how-section landing-how-white" aria-labelledby="landing-how-steps-title"><div className="landing-v2-shell"><MotionReveal className="landing-how-centered-heading"><p className="landing-v2-kicker">O FLUXO TODO</p><h2 id="landing-how-steps-title">Três movimentos para sair da pesquisa e chegar à conversa.</h2><p>O Prospectly organiza o trabalho para que você saiba o que procurar, por que priorizar e o que fazer depois.</p></MotionReveal><ol className="landing-how-step-list">{HOW_STEPS.map(({ number, icon: Icon, title, body, action }, index) => <RevealedListItem key={number} className="landing-how-step" delay={index * 90}><div className="landing-how-step-marker"><span>{number}</span><Icon weight="duotone" aria-hidden /></div><div className="landing-how-step-copy"><h3>{title}</h3><p>{body}</p><strong>{action}</strong></div></RevealedListItem>)}</ol></div></section>;
}

function HowDetailSections() {
  return <>
    <section className="landing-how-section landing-how-surface"><div className="landing-v2-shell landing-how-detail-grid"><MotionReveal className="landing-how-detail-copy"><p className="landing-v2-kicker">01 · DEFINA</p><h2>A busca começa com uma pergunta melhor.</h2><p>Em vez de procurar qualquer empresa, você começa pelo perfil que quer atender. Categoria e cidade viram um ponto de partida simples para uma lista com intenção.</p><ul><li><Check weight="bold" aria-hidden /> Categoria e cidade no mesmo fluxo</li><li><Check weight="bold" aria-hidden /> Recorte claro para cada pesquisa</li><li><Check weight="bold" aria-hidden /> Menos tempo em abas e planilhas</li></ul></MotionReveal><MotionReveal className="landing-how-detail-image" delay={100}><Image src="/images/workflow-desk.jpg" alt="Profissional pesquisando empresas em um notebook" fill sizes="(max-width: 800px) 100vw, 50vw" className="landing-v2-cover-image" /></MotionReveal></div></section>
    <section className="landing-how-section landing-how-white"><div className="landing-v2-shell landing-how-detail-grid landing-how-detail-reverse"><MotionReveal className="landing-how-detail-copy"><p className="landing-v2-kicker">02 · ENCONTRE</p><h2>O resultado chega organizado para você decidir.</h2><p>Você não precisa transformar cada resultado em uma planilha manual. Revise sinais, compare empresas e escolha onde a sua atenção faz mais sentido.</p><ul><li><Check weight="bold" aria-hidden /> Empresas reunidas em uma lista</li><li><Check weight="bold" aria-hidden /> Sinais para priorizar a revisão</li><li><Check weight="bold" aria-hidden /> Validação humana antes do contato</li></ul></MotionReveal><MotionReveal className="landing-how-detail-image" delay={100}><Image src="/images/local-business-intelligence.png" alt="Visualização de negócios locais conectados por dados" fill sizes="(max-width: 800px) 100vw, 50vw" className="landing-v2-cover-image" /></MotionReveal></div></section>
  </>;
}

function AfterListSection() {
  const afterSteps = [
    ['Revise', 'Confirme se a empresa e o sinal fazem sentido.'],
    ['Organize', 'Escolha estágio, responsável e próxima tarefa.'],
    ['Contextualize', 'Use o diagnóstico para preparar uma conversa relevante.'],
    ['Acompanhe', 'Registre o retorno sem perder o histórico.'],
  ];
  return <section className="landing-how-section landing-how-surface" aria-labelledby="landing-how-after-title"><div className="landing-v2-shell landing-how-after-layout"><MotionReveal className="landing-how-after-heading"><p className="landing-v2-kicker">DEPOIS DA LISTA</p><h2 id="landing-how-after-title">A pesquisa continua útil até o próximo passo.</h2><p>Uma lista só ajuda quando vira uma ação concreta. O fluxo termina onde a conversa começa.</p></MotionReveal><ol className="landing-how-after-list">{afterSteps.map(([title, body], index) => <RevealedListItem key={title} delay={index * 70}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{body}</p></div></RevealedListItem>)}</ol></div></section>;
}

export function LandingHowItWorksV2({ locale }: { locale: Locale }) {
  const enterUrl = enterExplainerUrl(locale);
  return <div className="landing-v2 landing-how-v2"><a className="landing-v2-skip-link" href="#conteudo-principal">Pular para o conteúdo principal</a><V2Header locale={locale} page="how" /><main id="conteudo-principal">
    <section className="landing-how-hero" aria-labelledby="landing-how-hero-title"><div className="landing-how-hero-glow" aria-hidden="true" /><div className="landing-v2-shell landing-how-hero-grid"><MotionReveal className="landing-how-hero-copy"><p className="landing-v2-kicker">COMO FUNCIONA</p><h1 id="landing-how-hero-title">Da busca à conversa, em três passos claros.</h1><p>Descubra como o Prospectly ajuda você a encontrar empresas, reconhecer oportunidades e organizar o próximo contato.</p><div className="landing-how-hero-actions"><Link href={enterUrl} className="landing-v2-green-button">Criar minha primeira lista <ArrowRight weight="bold" aria-hidden /></Link><a href="#fluxo" className="landing-v2-text-link">Explorar o fluxo</a></div></MotionReveal><MotionReveal className="landing-how-hero-visual" delay={120}><JourneyMock /></MotionReveal></div></section>
    <HowSteps /><HowDetailSections /><AfterListSection />
    <section className="landing-how-final"><div className="landing-v2-shell"><MotionReveal><p className="landing-v2-kicker">PRONTO PARA COMEÇAR?</p><h2>Encontre uma empresa. Entenda o contexto. Comece melhor.</h2><Link href={enterUrl} className="landing-v2-dark-button">Começar agora <ArrowRight weight="bold" aria-hidden /></Link></MotionReveal></div></section>
  </main><V2Footer page="how" /><CookieBanner locale={locale} /></div>;
}
