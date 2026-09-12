import { useQuery } from '@tanstack/react-query';
import { Coins, LogOut, Menu, PanelLeftOpen, Search } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { logout } from '@/features/auth/api';
import { getBillingStatus } from '@/features/billing/api';
import { ThemeToggle } from '@/features/theme/theme-toggle';
import { useAuthStore } from '@/stores/auth.store';
import { UserAvatar } from './user-avatar';

export function TopNav({
  onOpenNav,
  navOpen,
  showNavToggle = true,
  isDesktop = false,
}: {
  onOpenNav: () => void;
  navOpen: boolean;
  showNavToggle?: boolean;
  isDesktop?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, clear } = useAuthStore();

  useEffect(() => {
    const handleGlobalShortcuts = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        navigate('/search');
      } else if (
        event.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)
      ) {
        event.preventDefault();
        navigate('/search');
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [navigate]);

  const billing = useQuery({
    queryKey: ['billing', 'status'],
    queryFn: getBillingStatus,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });

  const hasLoadedCredits = billing.data !== undefined;
  const isCreditsLoading = (billing.isPending || billing.isLoading) && !hasLoadedCredits;
  const creditsLabel = t('nav.creditsBalance', {
    count: billing.data?.creditBalance ?? 0,
  });

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // proceed
    }
    clear();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-[color:var(--border-default)] bg-[color:var(--bg-surface)]">
      <div className="flex h-full items-center gap-2 px-3 lg:px-5">
        {showNavToggle ? (
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-control text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)]"
            onClick={onOpenNav}
            aria-label={isDesktop ? t('nav.showSidebar') : t('nav.openMenu')}
            title={isDesktop ? t('nav.showSidebar') : t('nav.openMenu')}
            aria-expanded={navOpen}
            aria-controls="mobile-nav"
          >
            {isDesktop ? (
              <PanelLeftOpen className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>
        ) : null}

        <Link
          to="/search"
          className="inline-flex h-11 w-11 items-center justify-center rounded-control text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)] sm:hidden"
          aria-label={t('nav.searchClients')}
        >
          <Search className="h-4 w-4" />
        </Link>

        <Link
          to="/search"
          className="group relative hidden h-11 min-w-0 flex-1 items-center gap-2 rounded-control border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] px-3 text-sm text-[color:var(--ink)] transition-colors hover:border-[color:var(--border-strong)] focus:bg-[color:var(--bg-surface)] focus:outline-none sm:inline-flex sm:max-w-xs lg:max-w-sm"
          aria-label={t('nav.searchClients')}
        >
          <Search
            className="pointer-events-none h-4 w-4 shrink-0 text-[color:var(--ink-muted)]"
            aria-hidden
          />
          <span className="truncate text-sm font-normal text-[color:var(--ink-muted)]">
            {t('nav.globalSearch', { defaultValue: 'Busca global...' })}
          </span>
          <kbd className="ml-auto pointer-events-none hidden items-center rounded border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--ink-muted)] md:inline-flex">
            ⌘K
          </kbd>
        </Link>

        <div className="flex-1" />

        <Link
          to="/credits"
          className="inline-flex h-11 w-11 items-center justify-center rounded-control text-[color:var(--brand-hover)] hover:bg-[color:var(--brand-soft)] sm:hidden"
          aria-label={creditsLabel}
        >
          <Coins className="h-4 w-4" aria-hidden />
        </Link>

        <Link
          to="/credits"
          className="hidden min-h-11 items-center gap-1.5 rounded-full border border-[color:var(--brand-soft)] bg-[color:var(--brand-soft)] px-3 text-xs font-semibold text-[color:var(--brand-hover)] transition-colors hover:bg-[color:var(--brand-well)] sm:inline-flex"
          title={t('nav.credits')}
        >
          <Coins className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {isCreditsLoading ? (
            <span
              className="inline-block h-3 w-14 animate-pulse rounded bg-[color:var(--brand)]/20"
              aria-label={t('common.loading')}
            />
          ) : (
            <span>{creditsLabel}</span>
          )}
        </Link>

        <ThemeToggle />

        <UserAvatar
          name={user?.name}
          avatarUrl={user?.avatarUrl}
          label={t('nav.account', { name: user?.name ?? '' })}
        />

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="inline-flex h-11 w-11 items-center justify-center rounded-control text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--ink)]"
          aria-label={t('nav.logout')}
          title={t('nav.logout')}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
