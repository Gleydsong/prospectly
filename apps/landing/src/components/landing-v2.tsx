import Link from 'next/link';
import { ArrowRight, Check } from '@phosphor-icons/react/ssr';
import { BrandIntro } from '@/components/brand-intro';
import { CookieBanner } from '@/components/cookie-banner';
import { FaqAccordion } from '@/components/landing-v2-faq';
import { V2Footer } from '@/components/landing-v2-footer';
import { V2Header } from '@/components/landing-v2-header';
import { SignalHeroScene } from '@/components/signal-hero-scene';
import { getFaqItems, getHomeFaqItems } from '@/lib/faq-content';
import { t, type Locale } from '@/lib/i18n';
import { appOnboardingUrl } from '@/lib/pricing';

function HeroSection({ locale }: { locale: Locale }) {
  const onboardingUrl = appOnboardingUrl();

  return (
    <section className="relative overflow-hidden pt-8 pb-14 sm:pb-20 lg:pt-12 lg:pb-24" aria-labelledby="landing-v2-hero-title">
      <div className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Coluna de Texto e Tipografia Editorial */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            {/* Eyebrow Rótulo (Desktop) */}
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sinal/30 dark:bg-azul-prospectly/20 border border-sinal/50 dark:border-azul-prospectly/30 text-azul-prospectly dark:text-blue-300 font-mono text-[11px] font-semibold tracking-[0.14em] uppercase mb-6">
              <span>{t(locale, 'heroEyebrow')}</span>
            </div>

            {/* Display XL Título (Inter Tight 800) */}
            <h1
              id="landing-v2-hero-title"
              className="font-display font-extrabold text-[42px] sm:text-[58px] lg:text-[76px] leading-[0.98] tracking-[-0.04em] text-tinta dark:text-white mb-6 text-balance"
            >
              {t(locale, 'heroLead')}
            </h1>

            {/* Corpo (Inter 400 16/1.55) */}
            <p className="font-sans text-base sm:text-lg lg:text-xl text-grafite/85 dark:text-zinc-300 leading-relaxed max-w-[560px] mb-8">
              {t(locale, 'heroSubtitle')}
            </p>

            {/* Ações / Botões */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
              <a
                href={onboardingUrl}
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-azul-prospectly hover:bg-blue-700 text-white font-semibold text-sm sm:text-base shadow-[0_12px_28px_rgba(37,99,235,0.35)] hover:shadow-[0_16px_36px_rgba(37,99,235,0.45)] hover:-translate-y-0.5 transition-all"
              >
                <span>{t(locale, 'heroPrimary')}</span>
                <ArrowRight weight="bold" className="w-4 h-4" aria-hidden />
              </a>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full border border-linha dark:border-white/20 bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-tinta dark:text-white font-medium text-sm sm:text-base transition-all"
              >
                <span>{t(locale, 'heroSecondary')}</span>
              </a>
            </div>

            {/* Texto de Confiança / Prova */}
            <p className="font-mono text-[11px] sm:text-xs text-grafite/65 dark:text-zinc-400 mt-4 tracking-wide">
              <span className="sm:hidden">Sem cartão · Dados no Brasil</span>
              <span className="hidden sm:inline">{t(locale, 'heroTrust')}</span>
            </p>
          </div>

          {/* Coluna Visual do Objeto 3D em Three.js com Materiais Físicos */}
          <div className="lg:col-span-5 relative w-full flex items-center justify-center">
            <SignalHeroScene locale={locale} />
          </div>
        </div>
      </div>
    </section>
  );
}

function NumbersStrip({ locale }: { locale: Locale }) {
  return (
    <section className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 my-6 sm:my-10" aria-label="Números da plataforma">
      <div className="rounded-[28px] bg-tinta text-white p-8 sm:p-10 lg:p-12 relative overflow-hidden shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 lg:gap-12">
        {/* Métricas Reais do Produto */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12 w-full lg:w-auto">
          {/* Métrica 1: 400 créditos grátis */}
          <div className="flex flex-col">
            <strong className="font-display font-extrabold text-5xl sm:text-6xl lg:text-7xl leading-none text-white tracking-tight">
              {t(locale, 'stat1Value')}
            </strong>
            <span className="text-xs sm:text-sm text-zinc-400 mt-2 max-w-[150px] leading-snug">
              {t(locale, 'stat1Label')}
            </span>
          </div>

          {/* Métrica 2: 2 fontes de dados */}
          <div className="flex flex-col">
            <strong className="font-display font-extrabold text-5xl sm:text-6xl lg:text-7xl leading-none text-white tracking-tight">
              {t(locale, 'stat2Value')}
            </strong>
            <span className="text-xs sm:text-sm text-zinc-400 mt-2 max-w-[180px] leading-snug">
              {t(locale, 'stat2Label')}
            </span>
          </div>

          {/* Métrica 3: 100% lista de supressão */}
          <div className="flex flex-col">
            <strong className="font-display font-extrabold text-5xl sm:text-6xl lg:text-7xl leading-none text-white tracking-tight">
              {t(locale, 'stat3Value')}
            </strong>
            <span className="text-xs sm:text-sm text-zinc-400 mt-2 max-w-[200px] leading-snug">
              {t(locale, 'stat3Label')}
            </span>
          </div>
        </div>

        {/* Símbolo de Sinal 3D decorativo à direita */}
        <div className="hidden lg:flex items-center justify-center flex-shrink-0 w-32 h-32 relative select-none pointer-events-none" aria-hidden="true">
          <svg className="w-28 h-28 drop-shadow-[0_0_24px_rgba(76,141,255,0.4)]" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="38" stroke="url(#stripRingGrad)" strokeWidth="12" />
            <circle cx="50" cy="50" r="46" stroke="#4C8DFF" strokeWidth="1" strokeOpacity="0.5" />
            <circle cx="78" cy="24" r="9" fill="#D4F56A" />
            <defs>
              <linearGradient id="stripRingGrad" x1="20" y1="20" x2="80" y2="80">
                <stop offset="0%" stopColor="#4C8DFF" />
                <stop offset="60%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#709AC0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </section>
  );
}

function BentoSection({ locale }: { locale: Locale }) {
  return (
    <section id="por-que" className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24" aria-labelledby="landing-v2-bento-title">
      {/* Topline Editorial */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12 sm:mb-16">
        <div>
          <span className="font-mono text-xs font-semibold tracking-[0.14em] uppercase text-azul-prospectly block mb-3">
            {t(locale, 'bentoEyebrow')}
          </span>
          <h2 id="landing-v2-bento-title" className="font-display font-extrabold text-3xl sm:text-5xl lg:text-6xl tracking-[-0.03em] text-tinta dark:text-white leading-[1.05]">
            {t(locale, 'bentoTitleLine1')}
            <br />
            {t(locale, 'bentoTitleLine2')}
          </h2>
        </div>
        <p className="font-sans text-base sm:text-lg text-grafite/80 dark:text-zinc-400 max-w-[440px] leading-relaxed">
          {t(locale, 'bentoLead')}
        </p>
      </div>

      {/* Grid Bento (01-landing-desktop.png) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
        {/* Card 01: Busca por cidade e nicho (Largo, 7 colunas) */}
        <div className="lg:col-span-7 rounded-[20px] bg-white dark:bg-zinc-900 border border-linha dark:border-white/10 p-7 sm:p-8 flex flex-col justify-between shadow-sm overflow-hidden">
          <div>
            <span className="font-mono text-xs text-grafite/60 dark:text-zinc-500 font-semibold block mb-2">
              {t(locale, 'bentoCard1Number')}
            </span>
            <h3 className="font-display font-bold text-xl sm:text-2xl text-tinta dark:text-white mb-2">
              {t(locale, 'bentoCard1Title')}
            </h3>
            <p className="text-sm sm:text-base text-grafite/75 dark:text-zinc-400 max-w-[480px]">
              {t(locale, 'bentoCard1Desc')}
            </p>
          </div>

          {/* Gráfico do Mapa / Radar de Oportunidades com Esferas Azuis */}
          <div className="mt-8 pt-6 border-t border-linha/50 dark:border-white/10 flex items-center justify-center" aria-hidden="true">
            <svg className="w-full max-w-[460px] h-36" viewBox="0 0 460 140" fill="none">
              <defs>
                <pattern id="bentoGridPattern" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#B9D8EF" strokeWidth="1" strokeOpacity="0.4" />
                </pattern>
                <radialGradient id="sphereDotGrad" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#93C5FD" />
                  <stop offset="40%" stopColor="#4C8DFF" />
                  <stop offset="100%" stopColor="#1D4ED8" />
                </radialGradient>
              </defs>
              {/* Malha de grade */}
              <rect width="460" height="140" fill="url(#bentoGridPattern)" rx="8" />
              {/* Nós / Oportunidades encontradas */}
              <circle cx="80" cy="50" r="10" fill="url(#sphereDotGrad)" className="drop-shadow-md" />
              <circle cx="150" cy="85" r="7" fill="url(#sphereDotGrad)" className="drop-shadow-md" />
              <circle cx="210" cy="65" r="9" fill="url(#sphereDotGrad)" className="drop-shadow-md" />
              <circle cx="270" cy="40" r="12" fill="url(#sphereDotGrad)" className="drop-shadow-lg" />
              <circle cx="340" cy="90" r="8" fill="url(#sphereDotGrad)" className="drop-shadow-md" />
              <circle cx="400" cy="55" r="11" fill="url(#sphereDotGrad)" className="drop-shadow-md" />
            </svg>
          </div>
        </div>

        {/* Card 02: Pontuação de oportunidade (Dark navy, 5 colunas) */}
        <div className="lg:col-span-5 rounded-[20px] bg-gradient-to-br from-[#1E3A8A] via-[#172554] to-[#0B1220] text-white p-7 sm:p-8 flex items-center justify-between shadow-md relative overflow-hidden">
          <div className="z-10">
            <span className="font-mono text-xs text-blue-300 font-semibold block mb-2">
              {t(locale, 'bentoCard2Number')}
            </span>
            <h3 className="font-display font-bold text-xl sm:text-2xl text-white mb-2">
              {t(locale, 'bentoCard2Title')}
            </h3>
            <p className="text-sm text-blue-100/80 max-w-[240px] leading-relaxed">
              {t(locale, 'bentoCard2Desc')}
            </p>
          </div>

          {/* Esfera 3D pérola/sinal reflexiva à direita */}
          <div className="w-28 h-28 flex-shrink-0 relative select-none pointer-events-none" aria-hidden="true">
            <svg className="w-full h-full drop-shadow-[0_16px_32px_rgba(0,0,0,0.4)]" viewBox="0 0 100 100">
              <defs>
                <radialGradient id="pearlSphereGrad" cx="30%" cy="25%" r="75%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="35%" stopColor="#DCE8F4" />
                  <stop offset="70%" stopColor="#9AB8D4" />
                  <stop offset="100%" stopColor="#436384" />
                </radialGradient>
              </defs>
              <circle cx="50" cy="50" r="42" fill="url(#pearlSphereGrad)" />
            </svg>
          </div>
        </div>

        {/* Card 03: Funil em etapas (Lima #D4F56A, 6 colunas) */}
        <div className="lg:col-span-6 rounded-[20px] bg-lima text-tinta p-7 sm:p-8 flex flex-col justify-between shadow-sm">
          <div>
            <span className="font-mono text-xs text-tinta/60 font-semibold block mb-2">
              {t(locale, 'bentoCard3Number')}
            </span>
            <h3 className="font-display font-bold text-xl sm:text-2xl text-tinta mb-2">
              {t(locale, 'bentoCard3Title')}
            </h3>
          </div>
          <p className="text-sm sm:text-base text-tinta/80 font-medium mt-6">
            {t(locale, 'bentoCard3Desc')}
          </p>
        </div>

        {/* Card 04: LGPD de fábrica (Branco/Papel, 6 colunas) */}
        <div className="lg:col-span-6 rounded-[20px] bg-white dark:bg-zinc-900 border border-linha dark:border-white/10 p-7 sm:p-8 flex flex-col justify-between shadow-sm">
          <div>
            <span className="font-mono text-xs text-grafite/60 dark:text-zinc-500 font-semibold block mb-2">
              {t(locale, 'bentoCard4Number')}
            </span>
            <h3 className="font-display font-bold text-xl sm:text-2xl text-tinta dark:text-white mb-2">
              {t(locale, 'bentoCard4Title')}
            </h3>
          </div>
          <p className="text-sm sm:text-base text-grafite/75 dark:text-zinc-400 mt-6">
            {t(locale, 'bentoCard4Desc')}
          </p>
        </div>
      </div>
    </section>
  );
}

function StepsSection({ locale }: { locale: Locale }) {
  return (
    <section id="como-funciona" className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24" aria-labelledby="landing-v2-steps-title">
      <div className="mb-12 sm:mb-16">
        <span className="font-mono text-xs font-semibold tracking-[0.14em] uppercase text-azul-prospectly block mb-3">
          {t(locale, 'stepsEyebrow')}
        </span>
        <h2 id="landing-v2-steps-title" className="font-display font-extrabold text-3xl sm:text-5xl lg:text-6xl tracking-[-0.03em] text-tinta dark:text-white">
          {t(locale, 'stepsTitle')}
        </h2>
      </div>

      {/* 3 Cartões em Linha */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {/* Passo 1 */}
        <div className="rounded-[20px] bg-white dark:bg-zinc-900 border border-linha dark:border-white/10 p-7 sm:p-8 relative flex flex-col justify-between shadow-sm overflow-hidden">
          <div className="flex items-start justify-between">
            <span className="font-display font-extrabold text-7xl lg:text-8xl text-sinal/40 dark:text-white/10 leading-none select-none">
              {t(locale, 'step1Number')}
            </span>
            {/* Esfera Lima de sotaque no topo direito */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F7FED2] via-lima to-[#65A30D] shadow-md" aria-hidden="true" />
          </div>
          <div className="mt-8">
            <h3 className="font-display font-bold text-lg sm:text-xl text-tinta dark:text-white mb-2">
              {t(locale, 'step1Title')}
            </h3>
            <p className="text-sm text-grafite/75 dark:text-zinc-400 leading-relaxed">
              {t(locale, 'step1Desc')}
            </p>
          </div>
        </div>

        {/* Passo 2 */}
        <div className="rounded-[20px] bg-white dark:bg-zinc-900 border border-linha dark:border-white/10 p-7 sm:p-8 relative flex flex-col justify-between shadow-sm overflow-hidden">
          <div className="flex items-start justify-between">
            <span className="font-display font-extrabold text-7xl lg:text-8xl text-sinal/40 dark:text-white/10 leading-none select-none">
              {t(locale, 'step2Number')}
            </span>
          </div>
          <div className="mt-8">
            <h3 className="font-display font-bold text-lg sm:text-xl text-tinta dark:text-white mb-2">
              {t(locale, 'step2Title')}
            </h3>
            <p className="text-sm text-grafite/75 dark:text-zinc-400 leading-relaxed">
              {t(locale, 'step2Desc')}
            </p>
          </div>
        </div>

        {/* Passo 3 */}
        <div className="rounded-[20px] bg-white dark:bg-zinc-900 border border-linha dark:border-white/10 p-7 sm:p-8 relative flex flex-col justify-between shadow-sm overflow-hidden">
          <div className="flex items-start justify-between">
            <span className="font-display font-extrabold text-7xl lg:text-8xl text-sinal/40 dark:text-white/10 leading-none select-none">
              {t(locale, 'step3Number')}
            </span>
            {/* Esfera Azul brilhante no topo direito */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#93C5FD] via-azul-prospectly to-[#172554] shadow-md" aria-hidden="true" />
          </div>
          <div className="mt-8">
            <h3 className="font-display font-bold text-lg sm:text-xl text-tinta dark:text-white mb-2">
              {t(locale, 'step3Title')}
            </h3>
            <p className="text-sm text-grafite/75 dark:text-zinc-400 leading-relaxed">
              {t(locale, 'step3Desc')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ManifestoSection({ locale }: { locale: Locale }) {
  return (
    <section className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 my-10 sm:my-16" aria-label="Manifesto Prospectly">
      <div className="rounded-[28px] bg-tinta text-white p-8 sm:p-12 lg:p-16 relative overflow-hidden shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-12">
        {/* Texto Manifesto */}
        <div className="z-10 max-w-[620px]">
          <span className="font-mono text-xs font-semibold tracking-[0.14em] uppercase text-eletrico block mb-4">
            {t(locale, 'manifestoEyebrow')}
          </span>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-[-0.03em] leading-tight text-white mb-6 text-balance">
            {t(locale, 'manifestoTitle')}
          </h2>
          <p className="font-sans text-base sm:text-lg text-zinc-300 leading-relaxed">
            {t(locale, 'manifestoBody')}
          </p>
        </div>

        {/* Visual 3D Escuro do Sinal de Oportunidade */}
        <div className="w-full lg:w-[420px] h-64 sm:h-72 flex items-center justify-center relative select-none pointer-events-none" aria-hidden="true">
          <svg className="w-64 h-64 drop-shadow-[0_0_48px_rgba(37,99,235,0.45)]" viewBox="0 0 240 240" fill="none">
            <circle cx="130" cy="120" r="76" stroke="url(#manifestoRingGrad)" strokeWidth="26" />
            <circle cx="130" cy="120" r="90" stroke="#4C8DFF" strokeWidth="1.5" strokeOpacity="0.4" />
            <circle cx="130" cy="120" r="62" stroke="#709AC0" strokeWidth="1" strokeOpacity="0.3" />
            {/* Esfera Lima flutuando */}
            <circle cx="204" cy="48" r="18" fill="url(#manifestoLimeGrad)" className="drop-shadow-lg" />
            {/* Esfera Pérola na base */}
            <circle cx="70" cy="176" r="24" fill="url(#manifestoPearlGrad)" className="drop-shadow-xl" />
            <defs>
              <linearGradient id="manifestoRingGrad" x1="50" y1="40" x2="210" y2="200">
                <stop offset="0%" stopColor="#4C8DFF" />
                <stop offset="50%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#1E3A8A" />
              </linearGradient>
              <radialGradient id="manifestoLimeGrad" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#F7FED2" />
                <stop offset="40%" stopColor="#D4F56A" />
                <stop offset="100%" stopColor="#4D7C0F" />
              </radialGradient>
              <radialGradient id="manifestoPearlGrad" cx="30%" cy="25%" r="75%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="50%" stopColor="#B9D8EF" />
                <stop offset="100%" stopColor="#2563EB" />
              </radialGradient>
            </defs>
          </svg>
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection({ locale }: { locale: Locale }) {
  const onboardingUrl = appOnboardingUrl();

  return (
    <section className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 my-10 sm:my-16" aria-labelledby="landing-v2-final-title">
      <div className="rounded-[28px] bg-azul-prospectly text-white p-8 sm:p-12 lg:p-16 relative overflow-hidden shadow-[0_20px_50px_rgba(37,99,235,0.35)] flex flex-col lg:flex-row items-center justify-between gap-10">
        {/* Conteúdo de Chamada */}
        <div className="z-10 max-w-[620px]">
          <h2 id="landing-v2-final-title" className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-[-0.03em] leading-tight text-white mb-6 text-balance">
            {t(locale, 'finalCtaTitle')}
          </h2>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <a
              href={onboardingUrl}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-white text-tinta font-semibold text-sm sm:text-base hover:bg-papel hover:shadow-lg transition-all"
            >
              <span>{t(locale, 'finalCtaButton')}</span>
              <ArrowRight weight="bold" className="w-4 h-4" aria-hidden />
            </a>
            <span className="text-xs sm:text-sm text-blue-100 font-medium">
              {t(locale, 'finalCtaSubtext')}
            </span>
          </div>
        </div>

        {/* Visual 3D Azul decorativo à direita */}
        <div className="w-64 h-56 flex-shrink-0 flex items-center justify-center relative select-none pointer-events-none" aria-hidden="true">
          <svg className="w-56 h-56 drop-shadow-[0_12px_28px_rgba(11,18,32,0.25)]" viewBox="0 0 200 200" fill="none">
            <circle cx="100" cy="100" r="64" stroke="#4C8DFF" strokeWidth="22" />
            <circle cx="100" cy="100" r="76" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.4" />
            <circle cx="160" cy="45" r="16" fill="#D4F56A" className="drop-shadow-md" />
          </svg>
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
      className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 py-14 sm:py-20"
      aria-labelledby="landing-v2-faq-title"
    >
      <div className="max-w-[760px] mx-auto">
        <div className="text-center mb-10">
          <span className="font-mono text-xs font-semibold tracking-[0.14em] uppercase text-azul-prospectly block mb-2">
            PERGUNTAS FREQUENTES
          </span>
          <TitleTag id="landing-v2-faq-title" className="font-display font-extrabold text-3xl sm:text-4xl text-tinta dark:text-white">
            Tudo claro antes de começar.
          </TitleTag>
          <p className="text-sm sm:text-base text-grafite/75 dark:text-zinc-400 mt-2">
            Respostas diretas para você dar o próximo passo com segurança.
          </p>
        </div>
        <FaqAccordion items={faqAccordionItems(locale, variant)} />
      </div>
    </section>
  );
}

function V2SkipLink() {
  return (
    <a
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-azul-prospectly focus:text-white focus:rounded-md"
      href="#conteudo-principal"
    >
      Pular para o conteúdo principal
    </a>
  );
}

const BENEFITS = [
  'Você fala com empresas que fazem sentido para o seu serviço.',
  'Cada contato vem organizado para você decidir rápido e agir melhor.',
  'A abordagem deixa de ser genérica e começa com um motivo concreto.',
] as const;

const AUDIENCES = [
  'Agências de marketing',
  'Designers',
  'Desenvolvedores',
  'Social media',
  'Fotógrafos',
  'Consultores',
  'Prestadores de serviço',
] as const;

function BenefitsSection({ variant = 'home' }: { variant?: 'home' | 'page' } = {}) {
  const TitleTag = variant === 'page' ? 'h1' : 'h2';
  return (
    <section
      id="beneficios"
      className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 py-14 sm:py-20"
      aria-labelledby="landing-v2-benefits-title"
    >
      <div className="max-w-[760px] mx-auto">
        <span className="font-mono text-xs font-semibold tracking-[0.14em] uppercase text-azul-prospectly block mb-2">
          POR QUE FUNCIONA
        </span>
        <TitleTag id="landing-v2-benefits-title" className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.03em] text-tinta dark:text-white mb-4">
          Menos volume. Mais chance de fechar.
        </TitleTag>
        <p className="text-base sm:text-lg text-grafite/80 dark:text-zinc-300 leading-relaxed mb-8">
          Uma lista boa não é a maior. É a que ajuda você a reconhecer quem pode valorizar o seu trabalho.
        </p>
        <ul className="flex flex-col gap-4">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3 text-base text-grafite dark:text-zinc-200">
              <span className="w-5 h-5 rounded-full bg-azul-prospectly/10 text-azul-prospectly flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check weight="bold" className="w-3.5 h-3.5" aria-hidden />
              </span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function AudienceSection({ variant = 'home' }: { variant?: 'home' | 'page' } = {}) {
  const TitleTag = variant === 'page' ? 'h1' : 'h2';
  return (
    <section
      id="para-quem"
      className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 py-14 sm:py-20"
      aria-labelledby="landing-v2-audience-title"
    >
      <div className="max-w-[760px] mx-auto text-center">
        <span className="font-mono text-xs font-semibold tracking-[0.14em] uppercase text-azul-prospectly block mb-2">
          IDEAL PARA
        </span>
        <TitleTag id="landing-v2-audience-title" className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.03em] text-tinta dark:text-white mb-4">
          Encontre empresas prontas para valorizar o que você faz.
        </TitleTag>
        <p className="text-base sm:text-lg text-grafite/80 dark:text-zinc-300 leading-relaxed mb-8">
          Da primeira busca ao contato certo: aproxime seu trabalho de quem já precisa dele.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {AUDIENCES.map((audience) => (
            <span
              key={audience}
              className="px-4 py-2 rounded-full border border-linha dark:border-white/10 bg-white dark:bg-zinc-900 text-sm font-medium text-grafite dark:text-zinc-200 shadow-sm"
            >
              {audience}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingV2({ locale }: { locale: Locale }) {
  return (
    <div className="landing-v2 min-h-screen bg-papel dark:bg-tinta text-tinta dark:text-zinc-100 font-sans" data-brand-intro-state="pending">
      <BrandIntro />
      <V2SkipLink />
      <V2Header locale={locale} />
      <main id="conteudo-principal">
        <HeroSection locale={locale} />
        <NumbersStrip locale={locale} />
        <BentoSection locale={locale} />
        <StepsSection locale={locale} />
        <ManifestoSection locale={locale} />
        <FinalCtaSection locale={locale} />
        <FaqBlock locale={locale} />
      </main>
      <V2Footer locale={locale} />
      <CookieBanner locale={locale} />
    </div>
  );
}

export function LandingV2SectionPage({
  locale,
  section,
}: {
  locale: Locale;
  section: 'benefits' | 'audience' | 'faq';
}) {
  return (
    <div className="landing-v2 min-h-screen bg-papel dark:bg-tinta text-tinta dark:text-zinc-100 font-sans">
      <V2SkipLink />
      <V2Header locale={locale} page="section" />
      <main id="conteudo-principal">
        {section === 'benefits' ? <BenefitsSection variant="page" /> : null}
        {section === 'audience' ? <AudienceSection variant="page" /> : null}
        {section === 'faq' ? <FaqBlock locale={locale} variant="page" /> : null}
      </main>
      <V2Footer locale={locale} page="section" />
      <CookieBanner locale={locale} />
    </div>
  );
}
