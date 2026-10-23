import Link from 'next/link';
import { V2Brand } from '@/components/landing-v2-brand';
import { t, type Locale } from '@/lib/i18n';

export function V2Footer({
  locale = 'pt',
  page = 'home',
}: {
  locale?: Locale;
  page?: 'home' | 'how' | 'section';
}) {
  const isEn = locale === 'en';
  const privacyUrl = isEn ? '/en/privacy' : '/privacy';
  const termsUrl = isEn ? '/en/terms' : '/terms';
  const pricingUrl = isEn ? '/en/pricing' : '/pricing';
  const homeUrl = isEn ? '/en' : '/';

  return (
    <footer className="w-full border-t border-linha/80 dark:border-white/10 bg-papel dark:bg-tinta py-14 lg:py-20 text-grafite dark:text-zinc-300" data-page={page}>
      <div className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row justify-between gap-12 lg:gap-16">
          {/* Coluna Marca e Slogan */}
          <div className="max-w-[340px]">
            <Link href={homeUrl} className="inline-block">
              <V2Brand />
            </Link>
            <p className="mt-4 text-sm text-grafite/80 dark:text-zinc-400 leading-relaxed">
              {t(locale, 'footerTagline')}
            </p>
          </div>

          {/* Colunas de Navegação */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 sm:gap-14">
            {/* PRODUTO */}
            <div className="flex flex-col gap-3">
              <strong className="font-mono text-xs font-semibold tracking-[0.14em] uppercase text-tinta dark:text-white">
                {t(locale, 'footerColProduct')}
              </strong>
              <Link href="/como-funciona" className="text-sm text-grafite/75 dark:text-zinc-400 hover:text-azul-prospectly dark:hover:text-white transition-colors">
                {t(locale, 'footerLinkSearch')}
              </Link>
              <Link href="/beneficios" className="text-sm text-grafite/75 dark:text-zinc-400 hover:text-azul-prospectly dark:hover:text-white transition-colors">
                {t(locale, 'footerLinkClients')}
              </Link>
              <Link href="/como-funciona" className="text-sm text-grafite/75 dark:text-zinc-400 hover:text-azul-prospectly dark:hover:text-white transition-colors">
                {t(locale, 'footerLinkFunnel')}
              </Link>
              <Link href={pricingUrl} className="text-sm text-grafite/75 dark:text-zinc-400 hover:text-azul-prospectly dark:hover:text-white transition-colors">
                {t(locale, 'footerLinkPricing')}
              </Link>
            </div>

            {/* EMPRESA */}
            <div className="flex flex-col gap-3">
              <strong className="font-mono text-xs font-semibold tracking-[0.14em] uppercase text-tinta dark:text-white">
                {t(locale, 'footerColCompany')}
              </strong>
              <a href="mailto:hello@prospectly.dev" className="text-sm text-grafite/75 dark:text-zinc-400 hover:text-azul-prospectly dark:hover:text-white transition-colors">
                {t(locale, 'footerLinkContact')}
              </a>
            </div>

            {/* LEGAL */}
            <div className="flex flex-col gap-3">
              <strong className="font-mono text-xs font-semibold tracking-[0.14em] uppercase text-tinta dark:text-white">
                {t(locale, 'footerColLegal')}
              </strong>
              <Link href={privacyUrl} className="text-sm text-grafite/75 dark:text-zinc-400 hover:text-azul-prospectly dark:hover:text-white transition-colors">
                {t(locale, 'footerLinkPrivacy')}
              </Link>
              <Link href={termsUrl} className="text-sm text-grafite/75 dark:text-zinc-400 hover:text-azul-prospectly dark:hover:text-white transition-colors">
                {t(locale, 'footerLinkTerms')}
              </Link>
              <Link href={privacyUrl} className="text-sm text-grafite/75 dark:text-zinc-400 hover:text-azul-prospectly dark:hover:text-white transition-colors">
                {t(locale, 'footerLinkSubprocessors')}
              </Link>
            </div>
          </div>
        </div>

        {/* Rodapé Inferior */}
        <div className="mt-14 pt-8 border-t border-linha/60 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-grafite/60 dark:text-zinc-500">
          <span>{t(locale, 'footerCopyright')}</span>
        </div>
      </div>
    </footer>
  );
}
