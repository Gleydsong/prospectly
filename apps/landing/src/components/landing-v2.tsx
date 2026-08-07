'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Buildings,
  CaretDown,
  Check,
  List,
  MapPin,
  ShieldCheck,
  Sparkle,
  X,
} from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { getHomeFaqItems } from '@/lib/faq-content';
import { enterExplainerUrl } from '@/lib/pricing';
import { TEAM_EMAIL, type Locale } from '@/lib/i18n';
import { CookieBanner } from '@/components/cookie-banner';

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

function V2Brand() {
  return <span className="landing-v2-brand" aria-label="Prospectly"><Image src="/brand/prospectly-mark-v2.svg" width={34} height={34} alt="" aria-hidden priority /><span>prospectly<span>.</span></span></span>;
}

export function V2Header({ locale, page = 'home' }: { locale: Locale; page?: 'home' | 'how' | 'section' }) {
  const [open, setOpen] = useState(false);
  const enterUrl = enterExplainerUrl(locale);
  const howUrl = '/v2/como-funciona';
  const benefitsUrl = '/v2/beneficios';
  const audienceUrl = '/v2/para-quem-e';
  const faqUrl = '/v2/duvidas';

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = ''; };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="landing-v2-header" data-page={page}>
      <div className="landing-v2-shell landing-v2-header-inner">
        <Link href="/v2" className="landing-v2-brand-link" onClick={close}><V2Brand /></Link>
        <nav className="landing-v2-desktop-nav" aria-label="Navegação principal">
          <Link href={howUrl} aria-current={page === 'how' ? 'page' : undefined}>Como funciona</Link><a href={benefitsUrl}>Benefícios</a><a href={audienceUrl}>Para quem é</a><a href={faqUrl}>Dúvidas frequentes</a>
        </nav>
        <div className="landing-v2-header-actions">
          <Link href={enterUrl} className="landing-v2-login">Entrar</Link>
          <Link href={enterUrl} className="landing-v2-dark-button landing-v2-header-cta">Começar agora <ArrowRight weight="bold" aria-hidden /></Link>
          <button type="button" className="landing-v2-menu-button" aria-expanded={open} aria-controls="landing-v2-mobile-nav" aria-label={open ? 'Fechar menu' : 'Abrir menu'} onClick={() => setOpen((value) => !value)}>
            {open ? <X weight="bold" aria-hidden /> : <List weight="bold" aria-hidden />}
          </button>
        </div>
      </div>
      {open ? <nav id="landing-v2-mobile-nav" className="landing-v2-mobile-nav" aria-label="Navegação móvel">
        <Link href={howUrl} onClick={close}>Como funciona</Link><a href={benefitsUrl} onClick={close}>Benefícios</a><a href={audienceUrl} onClick={close}>Para quem é</a><a href={faqUrl} onClick={close}>Dúvidas frequentes</a><Link href={enterUrl} onClick={close}>Entrar</Link>
      </nav> : null}
    </header>
  );
}

function Hero({ locale }: { locale: Locale }) {
  const enterUrl = enterExplainerUrl(locale);
  return (
    <section className="landing-v2-hero" aria-labelledby="landing-v2-hero-title">
      <div className="landing-v2-hero-glow" aria-hidden="true" />
      <div className="landing-v2-shell landing-v2-hero-content">
        <p className="landing-v2-kicker">AQUI VOCÊ ESCOLHE A OPORTUNIDADE</p>
        <h1 id="landing-v2-hero-title">Encontre as <span className="landing-v2-hero-emphasis">empresas certas</span><br />para o seu <span className="landing-v2-hero-emphasis">próximo cliente</span>.</h1>
        <p className="landing-v2-lead">O Prospectly encontra, filtra e organiza empresas para você prospectar com mais clareza — sem passar a manhã copiando informações do mapa.</p>
        <div className="landing-v2-search-card" aria-label="Demonstração de uma busca por empresas">
          <div className="landing-v2-search-topline"><div className="landing-v2-search-label"><Buildings weight="bold" aria-hidden /><span>BUSCANDO EMPRESAS REAIS</span></div><span className="landing-v2-search-status"><span /> Busca pronta</span></div>
          <div className="landing-v2-search-fields">
            <div className="landing-v2-search-field"><span>Segmento</span><strong>Clínicas odontológicas</strong></div>
            <div className="landing-v2-search-field"><span>Localização</span><strong><MapPin weight="bold" aria-hidden /> Curitiba, PR</strong></div>
            <span className="landing-v2-search-button">Buscar <ArrowRight weight="bold" aria-hidden /></span>
          </div>
          <div className="landing-v2-search-proof" aria-label="O que a busca entrega"><span><Check weight="bold" aria-hidden /> Empresa real</span><span><Check weight="bold" aria-hidden /> Sinal de oportunidade</span><span><Check weight="bold" aria-hidden /> Próximo passo claro</span></div>
        </div>
        <div className="landing-v2-hero-actions"><Link href={enterUrl} className="landing-v2-green-button">Criar minha primeira lista <ArrowRight weight="bold" aria-hidden /></Link><a href="#como-funciona" className="landing-v2-text-link">Ver como funciona</a></div>
        <a href="#como-funciona" className="landing-v2-scroll-cue">ROLE PARA EXPLORAR <ArrowDown weight="bold" aria-hidden /></a>
      </div>
    </section>
  );
}

function StepsSection() {
  return (
    <section id="como-funciona" className="landing-v2-section landing-v2-white landing-v2-anchor-offset" aria-labelledby="landing-v2-steps-title">
      <div className="landing-v2-shell landing-v2-split-section">
        <div className="landing-v2-section-copy landing-v2-reveal"><p className="landing-v2-kicker">COMO FUNCIONA</p><h2 id="landing-v2-steps-title">Um caminho simples até o próximo cliente.</h2><p className="landing-v2-section-intro">Da primeira busca ao contato certo, você sabe o que está vendo e qual é o próximo passo.</p>
          <ol className="landing-v2-step-list">{STEPS.map((step) => <li key={step.number}><span className="landing-v2-step-number">{step.number}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></li>)}</ol>
        </div>
        <div className="landing-v2-image-frame landing-v2-reveal"><Image src="/images/workflow-desk.jpg" alt="Profissional organizando uma busca de empresas em um notebook" fill sizes="(max-width: 900px) 100vw, 52vw" className="landing-v2-cover-image" /><div className="landing-v2-image-note"><Sparkle weight="fill" aria-hidden /> Menos pesquisa. Mais direção.</div></div>
      </div>
    </section>
  );
}

export function BenefitsSection() {
  return (
    <section id="beneficios" className="landing-v2-section landing-v2-mint landing-v2-anchor-offset" aria-labelledby="landing-v2-benefits-title">
      <div className="landing-v2-shell landing-v2-benefits-layout">
        <div className="landing-v2-benefits-copy landing-v2-reveal"><p className="landing-v2-kicker">POR QUE FUNCIONA</p><h2 id="landing-v2-benefits-title">Menos volume. Mais chance de fechar.</h2><p className="landing-v2-section-intro">Uma lista boa não é a maior. É a que ajuda você a reconhecer quem pode valorizar o seu trabalho.</p><ul className="landing-v2-check-list">{BENEFITS.map((benefit) => <li key={benefit}><span><Check weight="bold" aria-hidden /></span>{benefit}</li>)}</ul><Link href={enterExplainerUrl('pt')} className="landing-v2-outline-button">Encontrar empresas <ArrowUpRight weight="bold" aria-hidden /></Link></div>
        <div className="landing-v2-benefits-visual landing-v2-reveal"><div className="landing-v2-benefits-image-wrap"><Image src="/images/local-business-prospecting-premium.jpg" alt="Fachada de um negócio local com presença para ser encontrada" fill sizes="(max-width: 900px) 100vw, 56vw" className="landing-v2-cover-image" /></div><div className="landing-v2-floating-card"><div className="landing-v2-floating-icon"><ShieldCheck weight="bold" aria-hidden /></div><div><strong>Lista qualificada</strong><span>Pronta para revisar</span></div><Check weight="bold" aria-hidden /></div></div>
      </div>
    </section>
  );
}

export function AudienceSection() {
  return (
    <section id="para-quem" className="landing-v2-section landing-v2-white landing-v2-anchor-offset" aria-labelledby="landing-v2-audience-title"><div className="landing-v2-shell landing-v2-audience"><div className="landing-v2-centered-copy landing-v2-reveal"><p className="landing-v2-kicker">IDEAL PARA</p><h2 id="landing-v2-audience-title">Encontre empresas prontas para valorizar o que você faz.</h2><p className="landing-v2-section-intro">Da primeira busca ao contato certo: aproxime seu trabalho de quem já precisa dele.</p></div><div className="landing-v2-audience-chips" aria-label="Perfis que usam o Prospectly">{AUDIENCES.map((audience) => <span key={audience}>{audience}</span>)}</div><div className="landing-v2-audience-proof"><div><Buildings weight="bold" aria-hidden /><strong>Empresas brasileiras</strong><span>por categoria e cidade</span></div><div><MapPin weight="bold" aria-hidden /><strong>Dados organizados</strong><span>para agir sem copiar e colar</span></div><div><ShieldCheck weight="bold" aria-hidden /><strong>Mais contexto</strong><span>antes da primeira conversa</span></div></div></div></section>
  );
}

function FinalCtaSection({ locale }: { locale: Locale }) {
  const enterUrl = enterExplainerUrl(locale);
  return (
    <section className="landing-v2-final-cta" aria-labelledby="landing-v2-final-title"><Image src="/images/hero-street.jpg" alt="Rua com negócios locais ao fim do dia" fill sizes="100vw" className="landing-v2-final-image" /><div className="landing-v2-final-overlay" aria-hidden="true" /><div className="landing-v2-shell landing-v2-final-content landing-v2-reveal"><p className="landing-v2-kicker">O PRÓXIMO CLIENTE ESTÁ MAIS PERTO</p><h2 id="landing-v2-final-title">Pare de perder tempo procurando clientes.</h2><p>Encontre as melhores oportunidades, organize os contatos e comece conversas com um motivo concreto.</p><div className="landing-v2-final-actions"><Link href={enterUrl} className="landing-v2-green-button">Começar agora <ArrowRight weight="bold" aria-hidden /></Link><a href={`mailto:${TEAM_EMAIL}`} className="landing-v2-light-link">Falar com a equipe <ArrowUpRight weight="bold" aria-hidden /></a></div></div></section>
  );
}

export function FaqSection({ locale }: { locale: Locale }) {
  const items = getHomeFaqItems(locale);
  const [openId, setOpenId] = useState(items[0]?.id ?? '');
  return (
    <section id="faq" className="landing-v2-section landing-v2-white landing-v2-anchor-offset" aria-labelledby="landing-v2-faq-title"><div className="landing-v2-shell landing-v2-faq-layout"><div className="landing-v2-centered-copy landing-v2-reveal"><p className="landing-v2-kicker">PERGUNTAS FREQUENTES</p><h2 id="landing-v2-faq-title">Tudo claro antes de começar.</h2><p className="landing-v2-section-intro">Respostas diretas para você dar o próximo passo com segurança.</p></div><div className="landing-v2-faq-list landing-v2-reveal">{items.slice(0, 8).map((item) => { const isOpen = openId === item.id; return <div key={item.id} className="landing-v2-faq-item"><h3><button type="button" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? '' : item.id)}><span>{item.question}</span><CaretDown weight="bold" aria-hidden className={isOpen ? 'is-open' : ''} /></button></h3>{isOpen ? <p>{item.answer}</p> : null}</div>; })}</div></div></section>
  );
}

export function V2Footer({ page = 'home' }: { page?: 'home' | 'how' | 'section' }) {
  return <footer className="landing-v2-footer" data-page={page}><div className="landing-v2-shell landing-v2-footer-grid"><div><V2Brand /><p>Empresas certas. Próximos passos claros.</p></div><div><strong>Produto</strong><Link href="/v2/como-funciona">Como funciona</Link><Link href="/v2/beneficios">Benefícios</Link><Link href="/v2/duvidas">Perguntas frequentes</Link></div><div><strong>Legal</strong><Link href="/terms">Termos de uso</Link><Link href="/privacy">Política de privacidade</Link><a href={`mailto:${TEAM_EMAIL}`}>Fale com a gente</a></div></div><div className="landing-v2-shell landing-v2-footer-bottom"><span>© {new Date().getFullYear()} Prospectly</span><span>V2 · Prospecção B2B com mais clareza.</span></div></footer>;
}

export function LandingV2({ locale }: { locale: Locale }) {
  return <div className="landing-v2"><a className="landing-v2-skip-link" href="#conteudo-principal">Pular para o conteúdo principal</a><V2Header locale={locale} /><main id="conteudo-principal"><Hero locale={locale} /><StepsSection /><BenefitsSection /><AudienceSection /><FinalCtaSection locale={locale} /><FaqSection locale={locale} /></main><V2Footer /><CookieBanner locale={locale} /></div>;
}

export function LandingV2SectionPage({ locale, section }: { locale: Locale; section: 'benefits' | 'audience' | 'faq' }) {
  return <div className="landing-v2"><a className="landing-v2-skip-link" href="#conteudo-principal">Pular para o conteúdo principal</a><V2Header locale={locale} page="section" /><main id="conteudo-principal">
    {section === 'benefits' ? <BenefitsSection /> : null}
    {section === 'audience' ? <AudienceSection /> : null}
    {section === 'faq' ? <FaqSection locale={locale} /> : null}
  </main><V2Footer page="section" /><CookieBanner locale={locale} /></div>;
}
