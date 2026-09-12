import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Buildings,
  Check,
  MapPin,
  ShieldCheck,
  Sparkle,
} from '@phosphor-icons/react/ssr';
import { BrandIntro } from '@/components/brand-intro';
import { CookieBanner } from '@/components/cookie-banner';
import { FaqAccordion } from '@/components/landing-v2-faq';
import { V2Footer } from '@/components/landing-v2-footer';
import { V2Header } from '@/components/landing-v2-header';
import { getFaqItems, getHomeFaqItems } from '@/lib/faq-content';
import { TEAM_EMAIL, type Locale } from '@/lib/i18n';
import { appOnboardingUrl, enterExplainerUrl } from '@/lib/pricing';

const STEPS = [
  { number: '01', title: 'Defina quem você quer atender.', body: 'Escolha o segmento, a cidade e o tipo de empresa que faz sentido para o seu serviço.' },
  { number: '02', title: 'Receba oportunidades selecionadas.', body: 'Encontre empresas reais com dados organizados e sinais para decidir por onde começar.' },
  { number: '03', title: 'Converse com mais contexto.', body: 'Use a lista, o diagnóstico e as tarefas para transformar pesquisa em próximo passo.' },
] as const;

const BENEFITS = [
  'Você fala com empresas que fazem sentido para o seu serviço.',
  'Cada contato vem organizado para você decidir rápido e agir melhor.',
  'A abordagem deixa de ser genérica e começa com um motivo concreto.',
] as const;

const AUDIENCES = ['Agências de marketing', 'Designers', 'Desenvolvedores', 'Social media', 'Fotógrafos', 'Consultores', 'Prestadores de serviço'] as const;

function Hero() {
  const onboardingUrl = appOnboardingUrl();
  return (
    <section className="landing-v2-hero" aria-labelledby="landing-v2-hero-title">
      <div className="landing-v2-hero-glow" aria-hidden="true" />
      <div className="landing-v2-shell landing-v2-hero-content">
        <p className="landing-v2-kicker">AQUI VOCÊ ESCOLHE A OPORTUNIDADE</p>
        <h1 id="landing-v2-hero-title">
          Encontre as <span className="landing-v2-hero-emphasis">empresas certas</span>
          <br />
          para o seu <span className="landing-v2-hero-emphasis">próximo cliente</span>.
        </h1>
        <p className="landing-v2-lead">
          O Prospectly encontra, filtra e organiza empresas para você prospectar com mais clareza — sem passar a manhã
          copiando informações do mapa.
        </p>
        <div className="landing-v2-search-card" aria-label="Demonstração de uma busca por empresas">
          <div className="landing-v2-search-topline">
            <div className="landing-v2-search-label">
              <Buildings weight="bold" aria-hidden />
              <span>BUSCANDO EMPRESAS REAIS</span>
            </div>
            <span className="landing-v2-search-status">
              <span /> Busca pronta
            </span>
          </div>
          <div className="landing-v2-search-fields">
            <div className="landing-v2-search-field">
              <span>Segmento</span>
              <strong>Clínicas odontológicas</strong>
            </div>
            <div className="landing-v2-search-field">
              <span>Localização</span>
              <strong>
                <MapPin weight="bold" aria-hidden /> Curitiba, PR
              </strong>
            </div>
            <span className="landing-v2-search-button">
              Buscar <ArrowRight weight="bold" aria-hidden />
            </span>
          </div>
          <div className="landing-v2-search-proof" aria-label="O que a busca entrega">
            <span>
              <Check weight="bold" aria-hidden /> Empresa real
            </span>
            <span>
              <Check weight="bold" aria-hidden /> Sinal de oportunidade
            </span>
            <span>
              <Check weight="bold" aria-hidden /> Próximo passo claro
            </span>
          </div>
        </div>
        <div className="landing-v2-hero-actions">
          <a href={onboardingUrl} className="landing-v2-green-button">
            Criar minha primeira lista <ArrowRight weight="bold" aria-hidden />
          </a>
          <a href="#como-funciona" className="landing-v2-text-link">
            Ver como funciona
          </a>
        </div>
        <a href="#como-funciona" className="landing-v2-scroll-cue">
          ROLE PARA EXPLORAR <ArrowDown weight="bold" aria-hidden />
        </a>
      </div>
    </section>
  );
}

function StepsSection() {
  return (
    <section
      id="como-funciona"
      className="landing-v2-section landing-v2-white landing-v2-anchor-offset"
      aria-labelledby="landing-v2-steps-title"
    >
      <div className="landing-v2-shell landing-v2-split-section">
        <div className="landing-v2-section-copy landing-v2-reveal">
          <p className="landing-v2-kicker">COMO FUNCIONA</p>
          <h2 id="landing-v2-steps-title">Um caminho simples até o próximo cliente.</h2>
          <p className="landing-v2-section-intro">
            Da primeira busca ao contato certo, você sabe o que está vendo e qual é o próximo passo.
          </p>
          <ol className="landing-v2-step-list">
            {STEPS.map((step) => (
              <li key={step.number}>
                <span className="landing-v2-step-number">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="landing-v2-image-frame landing-v2-reveal">
          <Image
            src="/images/workflow-desk.jpg"
            alt="Profissional organizando uma busca de empresas em um notebook"
            fill
            sizes="(max-width: 900px) 100vw, 52vw"
            className="landing-v2-cover-image"
          />
          <div className="landing-v2-image-note">
            <Sparkle weight="fill" aria-hidden /> Menos pesquisa. Mais direção.
          </div>
        </div>
      </div>
    </section>
  );
}

function BenefitsSection({ variant = 'home' }: { variant?: 'home' | 'page' } = {}) {
  const TitleTag = variant === 'page' ? 'h1' : 'h2';
  return (
    <section
      id="beneficios"
      className="landing-v2-section landing-v2-mint landing-v2-anchor-offset"
      aria-labelledby="landing-v2-benefits-title"
    >
      <div className="landing-v2-shell landing-v2-benefits-layout">
        <div className="landing-v2-benefits-copy landing-v2-reveal">
          <p className="landing-v2-kicker">POR QUE FUNCIONA</p>
          <TitleTag id="landing-v2-benefits-title">Menos volume. Mais chance de fechar.</TitleTag>
          <p className="landing-v2-section-intro">
            Uma lista boa não é a maior. É a que ajuda você a reconhecer quem pode valorizar o seu trabalho.
          </p>
          <ul className="landing-v2-check-list">
            {BENEFITS.map((benefit) => (
              <li key={benefit}>
                <span>
                  <Check weight="bold" aria-hidden />
                </span>
                {benefit}
              </li>
            ))}
          </ul>
          <Link href={enterExplainerUrl('pt')} className="landing-v2-outline-button">
            Encontrar empresas <ArrowUpRight weight="bold" aria-hidden />
          </Link>
        </div>
        <div className="landing-v2-benefits-visual landing-v2-reveal">
          <div className="landing-v2-benefits-image-wrap">
            <Image
              src="/images/local-business-prospecting-premium.jpg"
              alt="Fachada de um negócio local com presença para ser encontrada"
              fill
              sizes="(max-width: 900px) 100vw, 56vw"
              className="landing-v2-cover-image"
            />
          </div>
          <div className="landing-v2-floating-card">
            <div className="landing-v2-floating-icon">
              <ShieldCheck weight="bold" aria-hidden />
            </div>
            <div>
              <strong>Lista qualificada</strong>
              <span>Pronta para revisar</span>
            </div>
            <Check weight="bold" aria-hidden />
          </div>
        </div>
      </div>
    </section>
  );
}

function AudienceSection({ variant = 'home' }: { variant?: 'home' | 'page' } = {}) {
  const TitleTag = variant === 'page' ? 'h1' : 'h2';
  return (
    <section
      id="para-quem"
      className="landing-v2-section landing-v2-white landing-v2-anchor-offset"
      aria-labelledby="landing-v2-audience-title"
    >
      <div className="landing-v2-shell landing-v2-audience">
        <div className="landing-v2-centered-copy landing-v2-reveal">
          <p className="landing-v2-kicker">IDEAL PARA</p>
          <TitleTag id="landing-v2-audience-title">Encontre empresas prontas para valorizar o que você faz.</TitleTag>
          <p className="landing-v2-section-intro">
            Da primeira busca ao contato certo: aproxime seu trabalho de quem já precisa dele.
          </p>
        </div>
        <div className="landing-v2-audience-chips" aria-label="Perfis que usam o Prospectly">
          {AUDIENCES.map((audience) => (
            <span key={audience}>{audience}</span>
          ))}
        </div>
        <div className="landing-v2-audience-proof">
          <div>
            <Buildings weight="bold" aria-hidden />
            <strong>Empresas brasileiras</strong>
            <span>por categoria e cidade</span>
          </div>
          <div>
            <MapPin weight="bold" aria-hidden />
            <strong>Dados organizados</strong>
            <span>para agir sem copiar e colar</span>
          </div>
          <div>
            <ShieldCheck weight="bold" aria-hidden />
            <strong>Mais contexto</strong>
            <span>antes da primeira conversa</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  const onboardingUrl = appOnboardingUrl();
  return (
    <section className="landing-v2-final-cta" aria-labelledby="landing-v2-final-title">
      <Image src="/images/hero-street.jpg" alt="Rua com negócios locais ao fim do dia" fill sizes="100vw" className="landing-v2-final-image" />
      <div className="landing-v2-final-overlay" aria-hidden="true" />
      <div className="landing-v2-shell landing-v2-final-content landing-v2-reveal">
        <p className="landing-v2-kicker">O PRÓXIMO CLIENTE ESTÁ MAIS PERTO</p>
        <h2 id="landing-v2-final-title">Pare de perder tempo procurando clientes.</h2>
        <p>Encontre as melhores oportunidades, organize os contatos e comece conversas com um motivo concreto.</p>
        <div className="landing-v2-final-actions">
          <a href={onboardingUrl} className="landing-v2-green-button">
            Começar agora <ArrowRight weight="bold" aria-hidden />
          </a>
          <a href={`mailto:${TEAM_EMAIL}`} className="landing-v2-light-link">
            Falar com a equipe <ArrowUpRight weight="bold" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}

function faqAccordionItems(locale: Locale, variant: 'home' | 'page') {
  const items = variant === 'page' ? getFaqItems(locale) : getHomeFaqItems(locale);
  return items.map(({ id, question, answer }) => ({ id, question, answer }));
}

function FaqBlock({ locale, variant = 'home' }: { locale: Locale; variant?: 'home' | 'page' }) {
  const TitleTag = variant === 'page' ? 'h1' : 'h2';
  return (
    <section
      id="faq"
      className="landing-v2-section landing-v2-white landing-v2-anchor-offset"
      aria-labelledby="landing-v2-faq-title"
    >
      <div className="landing-v2-shell landing-v2-faq-layout">
        <div className="landing-v2-centered-copy landing-v2-reveal">
          <p className="landing-v2-kicker">PERGUNTAS FREQUENTES</p>
          <TitleTag id="landing-v2-faq-title">Tudo claro antes de começar.</TitleTag>
          <p className="landing-v2-section-intro">Respostas diretas para você dar o próximo passo com segurança.</p>
        </div>
        <FaqAccordion items={faqAccordionItems(locale, variant)} />
      </div>
    </section>
  );
}

function V2SkipLink() {
  return (
    <a className="landing-v2-skip-link" href="#conteudo-principal">
      Pular para o conteúdo principal
    </a>
  );
}

export function LandingV2({ locale }: { locale: Locale }) {
  return (
    <div className="landing-v2" data-brand-intro-state="pending">
      <BrandIntro />
      <V2SkipLink />
      <V2Header locale={locale} />
      <main id="conteudo-principal">
        <Hero />
        <StepsSection />
        <BenefitsSection />
        <AudienceSection />
        <FinalCtaSection />
        <FaqBlock locale={locale} />
      </main>
      <V2Footer />
      <CookieBanner locale={locale} />
    </div>
  );
}

export function LandingV2SectionPage({ locale, section }: { locale: Locale; section: 'benefits' | 'audience' | 'faq' }) {
  return (
    <div className="landing-v2">
      <V2SkipLink />
      <V2Header locale={locale} page="section" />
      <main id="conteudo-principal">
        {section === 'benefits' ? <BenefitsSection variant="page" /> : null}
        {section === 'audience' ? <AudienceSection variant="page" /> : null}
        {section === 'faq' ? <FaqBlock locale={locale} variant="page" /> : null}
      </main>
      <V2Footer page="section" />
      <CookieBanner locale={locale} />
    </div>
  );
}
