import { PanelLeftClose, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { SignalRing } from '@/components/ui/signal-ring';
import { Skeleton } from '@/components/ui/skeleton';
import { useBillingStatus } from '@/features/billing/hooks';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { AccountMenu } from './account-menu';
import { TOOLS_NAV_ITEMS, WORKSPACE_NAV_ITEMS, isNavItemActive } from './nav-items';
import { TodaySummary } from './today-summary';

export function Sidebar({
  open,
  onClose,
  isDesktop,
  collapsed,
  onCollapse,
}: {
  open: boolean;
  onClose: () => void;
  isDesktop: boolean;
  collapsed: boolean;
  onCollapse: () => void;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const billing = useBillingStatus();
  const closeRef = useRef<HTMLButtonElement>(null);
  const expanded = isDesktop ? !collapsed : open;

  const hasBillingData = billing.data !== undefined;
  const isCreditsLoading = billing.isLoading || (!hasBillingData && !billing.isError);
  const isCreditsError = Boolean(billing.isError || (!isCreditsLoading && !hasBillingData));
  const creditBalance = billing.data?.creditBalance;

  useEffect(() => {
    if (open && !isDesktop) {
      closeRef.current?.focus();
    }
  }, [open, isDesktop]);

  return (
    <>
      {open && !isDesktop ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[var(--chrome-overlay)] lg:hidden"
          onClick={onClose}
          aria-label={t('nav.closeMenu')}
        />
      ) : null}
      <aside
        id="mobile-nav"
        aria-hidden={!expanded}
        inert={!expanded}
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-sidebar flex-col border-r border-[color:var(--border-default)] bg-[color:var(--bg-sidebar)] transition-transform duration-200 motion-reduce:transition-none',
          expanded ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Topo da sidebar com logo P. Prospectly */}
        <div className="flex h-16 items-center justify-between gap-2 border-b border-[color:var(--border-default)] px-5">
          <Link
            to="/"
            aria-label="Prospectly"
            className="inline-flex min-w-0 items-center gap-2 text-lg font-extrabold tracking-tight text-[color:var(--ink)] font-display"
            onClick={onClose}
          >
            <span className="flex items-center gap-1 font-display font-extrabold text-xl text-[color:var(--ink)]">
              P<span className="inline-block h-2 w-2 rounded-full bg-[color:var(--brand)]" aria-hidden="true" />
            </span>
            <span className="truncate leading-none">Prospectly</span>
          </Link>
          {isDesktop ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-control text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--ink)] transition-colors"
              onClick={onCollapse}
              aria-label={t('nav.hideSidebar')}
              title={t('nav.hideSidebar')}
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button
              ref={closeRef}
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-control text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--ink)] transition-colors"
              onClick={onClose}
              aria-label={t('nav.closeMenu')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navegação principal em 2 seções */}
        <nav
          className="flex-1 space-y-6 overflow-y-auto px-3 py-4"
          aria-label={t('nav.mainNav')}
        >
          {/* Seção 1: ESPAÇO DE TRABALHO */}
          <div className="space-y-1">
            <p className="px-3 pb-1.5 font-mono text-xs font-medium uppercase tracking-mono-label text-[color:var(--ink-muted)]">
              {t('nav.workspace')}
            </p>
            <div className="space-y-1">
              {WORKSPACE_NAV_ITEMS.map((item) => {
                const active = isNavItemActive(item.to, location.pathname, location.search);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    onClick={onClose}
                    tabIndex={expanded ? undefined : -1}
                    className={cn(
                      'group flex min-h-10 items-center gap-3 rounded-full px-3.5 text-sm font-medium transition-all duration-180',
                      active
                        ? 'bg-[color:var(--bg-nav-active)] font-semibold text-white dark:bg-[#233552] dark:text-white shadow-soft'
                        : 'text-[color:var(--ink-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:text-[color:var(--ink)]',
                    )}
                  >
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full transition-colors',
                        active
                          ? 'bg-[#D4F56A]'
                          : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400',
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Seção 2: FERRAMENTAS */}
          <div className="space-y-1">
            <p className="px-3 pb-1.5 font-mono text-xs font-medium uppercase tracking-mono-label text-[color:var(--ink-muted)]">
              {t('nav.ferramentas')}
            </p>
            <div className="space-y-1">
              {TOOLS_NAV_ITEMS.map((item) => {
                const active = isNavItemActive(item.to, location.pathname, location.search);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    onClick={onClose}
                    tabIndex={expanded ? undefined : -1}
                    className={cn(
                      'group flex min-h-10 items-center gap-3 rounded-full px-3.5 text-sm font-medium transition-all duration-180',
                      active
                        ? 'bg-[color:var(--bg-nav-active)] font-semibold text-white dark:bg-[#233552] dark:text-white shadow-soft'
                        : 'text-[color:var(--ink-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:text-[color:var(--ink)]',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
                        active
                          ? 'bg-[#D4F56A]'
                          : 'bg-transparent group-hover:bg-slate-300 dark:group-hover:bg-slate-600',
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Rodapé da sidebar: Cartão de créditos escuro + Menu de conta */}
        <div className="shrink-0 space-y-3 p-3 pt-0">
          {/* Cartão de Créditos redesenhado fiel a 02-app-inicio.png */}
          <div
            data-testid="sidebar-credits-card"
            className="relative overflow-hidden rounded-[20px] bg-[#0B1220] p-4 text-white shadow-soft border border-slate-800/60"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                {isCreditsLoading ? (
                  <Skeleton
                    data-testid="sidebar-credits-skeleton"
                    className="h-8 w-24 rounded-control bg-slate-800"
                  />
                ) : (
                  <div className="font-display text-3xl font-extrabold tracking-tight leading-none text-white">
                    {isCreditsError ? '—' : creditBalance?.toLocaleString()}
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-300">
                  {isCreditsError
                    ? t('settings.creditsError')
                    : t('settings.creditsRemaining')}
                </p>
                <Link
                  to="/credits"
                  onClick={onClose}
                  className="mt-3 inline-block text-xs font-semibold text-[#D4F56A] hover:underline transition-colors"
                >
                  {t('settings.buyMoreCredits')}
                </Link>
              </div>
              <div className="shrink-0 -mr-1">
                <SignalRing size={52} glow />
              </div>
            </div>
          </div>

          <TodaySummary />

          {/* Menu de Conta preservado */}
          {user ? <AccountMenu onNavigate={onClose} /> : null}
        </div>
      </aside>
    </>
  );
}
