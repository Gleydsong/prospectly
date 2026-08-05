import { Building2, Filter, Lock, MapPinned, Search, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const { t } = useTranslation();

  const benefits = [
    {
      icon: Filter,
      title: t('auth.benefit1Title'),
      body: t('auth.benefit1Body'),
    },
    {
      icon: MapPinned,
      title: t('auth.benefit2Title'),
      body: t('auth.benefit2Body'),
    },
    {
      icon: Search,
      title: t('auth.benefit3Title'),
      body: t('auth.benefit3Body'),
    },
  ] as const;

  const trustItems = [
    { icon: Lock, label: t('auth.trustSsl') },
    { icon: ShieldCheck, label: t('auth.trustLgpd') },
    { icon: Search, label: t('auth.trustFree') },
  ] as const;

  return (
    <div className="min-h-[100dvh] bg-zinc-950 lg:grid lg:grid-cols-2">
      <aside className="relative overflow-hidden border-b border-zinc-800 bg-[radial-gradient(ellipse_70%_55%_at_85%_15%,rgb(96_165_250_/_0.16),transparent_55%),radial-gradient(ellipse_45%_35%_at_0%_90%,rgb(250_250_250_/_0.04),transparent_50%),linear-gradient(180deg,#09090b_0%,#18181b_100%)] px-6 py-8 sm:px-10 lg:border-b-0 lg:border-r lg:px-12 lg:py-14">
        <div className="mx-auto flex h-full max-w-lg flex-col justify-center lg:mx-0">
          <div className="flex items-center gap-3">
            <span className="cta-glass flex h-11 w-11 items-center justify-center rounded-control">
              <Building2 className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-lg font-semibold tracking-tight text-zinc-50">{t('auth.brandName')}</p>
          </div>

          <h1 className="mt-8 max-w-[18ch] text-balance text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            {t('auth.brandManifesto')}
          </h1>
          <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-zinc-400">
            {t('auth.brandManifestoBody')}
          </p>

          <ul className="mt-8 hidden space-y-5 lg:block">
            {benefits.map(({ icon: Icon, title: benefitTitle, body }) => (
              <li key={benefitTitle} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-zinc-700 bg-zinc-900 text-brand-300">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-zinc-50">{benefitTitle}</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{body}</p>
                </div>
              </li>
            ))}
          </ul>

          <ul className="mt-6 grid gap-2 sm:grid-cols-3 lg:hidden">
            {benefits.map(({ title: benefitTitle }) => (
              <li
                key={benefitTitle}
                className="rounded-control border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs font-medium text-zinc-300"
              >
                {benefitTitle}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8 lg:px-12 lg:py-14">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{subtitle}</p>
          </div>

          {children}

          <ul className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-800 pt-6">
            {trustItems.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                <Icon className="h-3.5 w-3.5 text-brand-400" aria-hidden />
                {label}
              </li>
            ))}
          </ul>

          {footer ? <div className="mt-6 text-center text-sm text-zinc-400">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
