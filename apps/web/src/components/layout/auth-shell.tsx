import { Lock, Search, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { MonoLabel } from '@/components/ui/mono-label';
import { PageHeader } from '@/components/ui/page-header';
import { SignalRing } from '@/components/ui/signal-ring';
import { GlossSphere, type GlossSphereVariant } from '@/components/ui/gloss-sphere';
import { ThemeToggle } from '@/features/theme/theme-toggle';
import { cn } from '@/lib/utils';

export interface AuthShellProps {
  title: string;
  subtitle: string;
  panelTitle?: string;
  panelEyebrow?: string;
  panelDescription?: string;
  leftSphereVariant?: GlossSphereVariant;
  rightSphereVariant?: GlossSphereVariant;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function AuthShell({
  title,
  subtitle,
  panelTitle,
  panelEyebrow,
  panelDescription,
  leftSphereVariant = 'sinal',
  rightSphereVariant = 'lima',
  children,
  footer,
  className,
  contentClassName,
}: AuthShellProps) {
  const { t } = useTranslation();

  const eyebrow = panelEyebrow ?? t('auth.panelEyebrow', 'PROSPECÇÃO LOCAL');
  const mainTitle = panelTitle ?? t('auth.brandManifesto');
  const mainDescription =
    panelDescription ??
    t(
      'auth.panelDescription',
      'Encontre empresas sem site, salve as melhores e organize o contato em um só lugar.',
    );

  const trustItems = [
    { icon: Lock, label: t('auth.trustSsl') },
    { icon: ShieldCheck, label: t('auth.trustLgpd') },
    { icon: Search, label: t('auth.trustFree') },
  ] as const;

  return (
    <div className="relative min-h-[100dvh] bg-[color:var(--bg-app)] text-[color:var(--ink)] transition-colors duration-200">
      {/* Botão de alternância de tema no canto superior direito */}
      <div className="absolute right-4 top-4 z-30 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col p-4 sm:p-6 lg:p-8">
        <div className="grid flex-1 items-stretch gap-6 lg:grid-cols-12 lg:gap-10">
          {/* Painel escuro à esquerda (Desktop: card com anel/esferas CSS; Mobile: cabeçalho compacto) */}
          <aside
            aria-label={t('auth.productPresentation')}
            className={cn(
              'relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-[#1c2a42] bg-[#0b1220] p-6 text-white shadow-2xl sm:rounded-[28px] sm:p-8 lg:col-span-5 lg:min-h-[640px] lg:p-10 xl:col-span-5',
            )}
          >
            {/* Topo: Marca */}
            <div className="z-10 flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-base font-extrabold text-[#0b1220] shadow-sm"
              >
                P.
              </span>
              <span className="font-display text-lg font-bold tracking-tight text-white">
                Prospectly
              </span>
            </div>

            {/* Mobile: Cabeçalho compacto com resumo do anel */}
            <div
              data-testid="auth-shell-mobile"
              className="my-4 flex items-center justify-between gap-4 lg:hidden"
            >
              <div className="space-y-1">
                <MonoLabel className="text-[#709ac0]">{eyebrow}</MonoLabel>
                <p className="font-display text-base font-bold leading-snug text-white">
                  {mainTitle}
                </p>
              </div>
              <div className="relative shrink-0">
                <SignalRing size={56} glow />
                <div className="absolute -bottom-1 -left-1">
                  <GlossSphere variant={leftSphereVariant} size={22} />
                </div>
                <div className="absolute -right-1 -top-1">
                  <GlossSphere variant={rightSphereVariant} size={16} />
                </div>
              </div>
            </div>

            {/* Desktop: Composição 3D volumétrica central (CSS/SVG) */}
            <div className="relative my-auto hidden items-center justify-center py-10 lg:flex">
              <div className="relative inline-flex items-center justify-center select-none">
                <SignalRing size={180} glow className="relative z-10 drop-shadow-2xl" />
                {/* Esfera inferior esquerda */}
                <div className="absolute -bottom-3 -left-5 z-20 transition-transform duration-300">
                  <GlossSphere variant={leftSphereVariant} size={64} />
                </div>
                {/* Esfera superior direita */}
                <div className="absolute -right-3 -top-3 z-20 transition-transform duration-300">
                  <GlossSphere variant={rightSphereVariant} size={44} />
                </div>
              </div>
            </div>

            {/* Desktop: Bloco de texto do painel escuro */}
            <div
              data-testid="auth-shell-desktop"
              className="z-10 hidden space-y-3 lg:block"
            >
              <MonoLabel className="text-[#709ac0]">{eyebrow}</MonoLabel>
              <h2 className="font-display text-2xl font-extrabold tracking-display text-white sm:text-3xl lg:text-[2rem] leading-tight">
                {mainTitle}
              </h2>
              <p className="text-sm leading-relaxed text-[#b9d8ef]/80">
                {mainDescription}
              </p>
            </div>
          </aside>

          {/* Área do formulário à direita */}
          <main
            className={cn(
              'flex flex-col justify-center px-2 py-4 sm:px-6 lg:col-span-7 lg:px-10 xl:col-span-7',
              className,
            )}
          >
            <div className={cn('mx-auto w-full max-w-lg', contentClassName)}>
              <PageHeader
                title={title}
                description={subtitle}
                className="mb-6"
              />

              <div className="space-y-6">
                {children}

                {/* Sinais de confiança */}
                <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[color:var(--border-default)] pt-5 text-xs text-[color:var(--ink-secondary)]">
                  {trustItems.map(({ icon: Icon, label }) => (
                    <li key={label} className="flex items-center gap-1.5 font-medium">
                      <Icon className="h-3.5 w-3.5 text-[color:var(--brand)]" aria-hidden="true" />
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>

                {footer ? (
                  <div className="text-center text-sm text-[color:var(--ink-secondary)]">
                    {footer}
                  </div>
                ) : null}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
