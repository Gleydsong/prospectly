import Image from 'next/image';
import {
  ArrowRight,
  Check,
  Funnel,
  ListChecks,
  Target,
} from '@phosphor-icons/react/ssr';
import { CookieBanner } from '@/components/cookie-banner';
import { JourneyMock, MotionReveal, RevealedListItem } from '@/components/landing-how-motion';
import { V2Footer } from '@/components/landing-v2-footer';
import { V2Header } from '@/components/landing-v2-header';
import { appOnboardingUrl } from '@/lib/pricing';
import type { Locale } from '@/lib/i18n';

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

function HowSteps() {
  return (
    <section id="fluxo" className="landing-how-section landing-how-white" aria-labelledby="landing-how-steps-title">
      <div className="landing-v2-shell">
        <MotionReveal className="landing-how-centered-heading">
          <p className="landing-v2-kicker">O FLUXO TODO</p>
          <h2 id="landing-how-steps-title">Três movimentos para sair da pesquisa e chegar à conversa.</h2>
          <p>O Prospectly organiza o trabalho para que você saiba o que procurar, por que priorizar e o que fazer depois.</p>
        </MotionReveal>
        <ol className="landing-how-step-list">
          {HOW_STEPS.map(({ number, icon: Icon, title, body, action }, index) => (
            <RevealedListItem key={number} className="landing-how-step" delay={index * 90}>
              <div className="landing-how-step-marker">
                <span>{number}</span>
                <Icon weight="duotone" aria-hidden />
              </div>
              <div className="landing-how-step-copy">
                <h3>{title}</h3>
                <p>{body}</p>
                <strong>{action}</strong>
              </div>
            </RevealedListItem>
          ))}
        </ol>
      </div>
    </section>
  );
}

function HowDetailSections() {
  return (
    <>
      <section className="landing-how-section landing-how-surface">
        <div className="landing-v2-shell landing-how-detail-grid">
          <MotionReveal className="landing-how-detail-copy">
            <p className="landing-v2-kicker">01 · DEFINA</p>
            <h2>A busca começa com uma pergunta melhor.</h2>
            <p>
              Em vez de procurar qualquer empresa, você começa pelo perfil que quer atender. Categoria e cidade viram um
              ponto de partida simples para uma lista com intenção.
            </p>
            <ul>
              <li>
                <Check weight="bold" aria-hidden /> Categoria e cidade no mesmo fluxo
              </li>
              <li>
                <Check weight="bold" aria-hidden /> Recorte claro para cada pesquisa
              </li>
              <li>
                <Check weight="bold" aria-hidden /> Menos tempo em abas e planilhas
              </li>
            </ul>
          </MotionReveal>
          <MotionReveal className="landing-how-detail-image" delay={100}>
            <Image
              src="/images/workflow-desk.jpg"
              alt="Profissional pesquisando empresas em um notebook"
              fill
              sizes="(max-width: 800px) 100vw, 50vw"
              className="landing-v2-cover-image"
            />
          </MotionReveal>
        </div>
      </section>
      <section className="landing-how-section landing-how-white">
        <div className="landing-v2-shell landing-how-detail-grid landing-how-detail-reverse">
          <MotionReveal className="landing-how-detail-copy">
            <p className="landing-v2-kicker">02 · ENCONTRE</p>
            <h2>O resultado chega organizado para você decidir.</h2>
            <p>
              Você não precisa transformar cada resultado em uma planilha manual. Revise sinais, compare empresas e
              escolha onde a sua atenção faz mais sentido.
            </p>
            <ul>
              <li>
                <Check weight="bold" aria-hidden /> Empresas reunidas em uma lista
              </li>
              <li>
                <Check weight="bold" aria-hidden /> Sinais para priorizar a revisão
              </li>
              <li>
                <Check weight="bold" aria-hidden /> Validação humana antes do contato
              </li>
            </ul>
          </MotionReveal>
          <MotionReveal className="landing-how-detail-image" delay={100}>
            <Image
              src="/images/local-business-intelligence-light.png"
              alt="Negócios locais com sinais de dados organizados para revisão"
              fill
              sizes="(max-width: 800px) 100vw, 50vw"
              className="landing-v2-cover-image"
            />
          </MotionReveal>
        </div>
      </section>
    </>
  );
}

function AfterListSection() {
  const afterSteps = [
    ['Revise', 'Confirme se a empresa e o sinal fazem sentido.'],
    ['Organize', 'Escolha estágio, responsável e próxima tarefa.'],
    ['Contextualize', 'Use o diagnóstico para preparar uma conversa relevante.'],
    ['Acompanhe', 'Registre o retorno sem perder o histórico.'],
  ];
  return (
    <section className="landing-how-section landing-how-surface" aria-labelledby="landing-how-after-title">
      <div className="landing-v2-shell landing-how-after-layout">
        <MotionReveal className="landing-how-after-heading">
          <p className="landing-v2-kicker">DEPOIS DA LISTA</p>
          <h2 id="landing-how-after-title">A pesquisa continua útil até o próximo passo.</h2>
          <p>Uma lista só ajuda quando vira uma ação concreta. O fluxo termina onde a conversa começa.</p>
        </MotionReveal>
        <ol className="landing-how-after-list">
          {afterSteps.map(([title, body], index) => (
            <RevealedListItem key={title} delay={index * 70}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </RevealedListItem>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function LandingHowItWorksV2({ locale }: { locale: Locale }) {
  const onboardingUrl = appOnboardingUrl();
  return (
    <div className="landing-v2 landing-how-v2">
      <a className="landing-v2-skip-link" href="#conteudo-principal">
        Pular para o conteúdo principal
      </a>
      <V2Header locale={locale} page="how" />
      <main id="conteudo-principal">
        <section className="landing-how-hero" aria-labelledby="landing-how-hero-title">
          <div className="landing-how-hero-glow" aria-hidden="true" />
          <div className="landing-v2-shell landing-how-hero-grid">
            <MotionReveal className="landing-how-hero-copy">
              <p className="landing-v2-kicker">COMO FUNCIONA</p>
              <h1 id="landing-how-hero-title">Da busca à conversa, em três passos claros.</h1>
              <p>Descubra como o Prospectly ajuda você a encontrar empresas, reconhecer oportunidades e organizar o próximo contato.</p>
              <div className="landing-how-hero-actions">
                <a href={onboardingUrl} className="landing-v2-green-button">
                  Criar minha primeira lista <ArrowRight weight="bold" aria-hidden />
                </a>
                <a href="#fluxo" className="landing-v2-text-link">
                  Explorar o fluxo
                </a>
              </div>
            </MotionReveal>
            <MotionReveal className="landing-how-hero-visual" delay={120}>
              <JourneyMock />
            </MotionReveal>
          </div>
        </section>
        <HowSteps />
        <HowDetailSections />
        <AfterListSection />
        <section className="landing-how-final">
          <div className="landing-v2-shell">
            <MotionReveal>
              <p className="landing-v2-kicker">PRONTO PARA COMEÇAR?</p>
              <h2>Encontre uma empresa. Entenda o contexto. Comece melhor.</h2>
              <a href={onboardingUrl} className="landing-v2-dark-button">
                Começar agora
              </a>
            </MotionReveal>
          </div>
        </section>
      </main>
      <V2Footer page="how" />
      <CookieBanner locale={locale} />
    </div>
  );
}
