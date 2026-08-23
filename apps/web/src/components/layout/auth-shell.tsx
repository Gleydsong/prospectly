import { Filter, Lock, MapPinned, Search, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemeToggle } from '@/features/theme/theme-toggle';
import prospectlyMark from '@/assets/prospectly-mark-v2.svg';

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
    <div className="relative min-h-[100dvh] bg-[color:var(--bg)] lg:grid lg:grid-cols-2">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <aside className="auth-shell-panel relative overflow-hidden border-b border-[color:var(--border)] bg-[color:var(--surface-card)] px-6 py-8 sm:px-10 lg:border-b-0 lg:border-r lg:px-12 lg:py-14">
        <div className="mx-auto flex h-full max-w-lg flex-col justify-center lg:mx-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="cta-glass flex h-11 w-11 shrink-0 items-center justify-center rounded-control p-1.5">
              <img src={prospectlyMark} alt="" aria-hidden className="h-full w-full object-contain" />
            </span>
            <p className="truncate text-lg font-semibold tracking-tight text-[color:var(--ink)]">
              rospectly
            </p>
          </div>

          <h1 className="mt-8 max-w-[18ch] text-balance text-3xl font-semibold tracking-tight text-[color:var(--ink)] sm:text-4xl">
            {t('auth.brandManifesto')}
          </h1>
          <p className="mt-4 max-w-[42ch] text-base leading-relaxed text-[color:var(--ink-muted)]">
            {t('auth.brandManifestoBody')}
          </p>

          <ul className="mt-8 hidden space-y-5 lg:block">
            {benefits.map(({ icon: Icon, title: benefitTitle, body }) => (
              <li key={benefitTitle} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-zinc-700 bg-zinc-900 text-brand-300">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[color:var(--ink)]">{benefitTitle}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[color:var(--ink-muted)]">{body}</p>
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
            <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--ink)]">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-muted)]">{subtitle}</p>
          </div>

          {children}

          <ul className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[color:var(--border)] pt-6">
            {trustItems.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--ink-muted)]">
                <Icon className="h-3.5 w-3.5 text-[color:var(--accent)]" aria-hidden />
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
