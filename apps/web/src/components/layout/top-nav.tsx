import { Menu, PanelLeftOpen, Search } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { ThemeToggle } from '@/features/theme/theme-toggle';

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

  useEffect(() => {
    const handleGlobalShortcuts = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        navigate('/prospectar');
      } else if (
        event.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)
      ) {
        event.preventDefault();
        navigate('/prospectar');
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [navigate]);

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-[color:var(--border-default)] bg-[color:var(--bg-surface)] backdrop-blur-md">
      <div className="flex h-full items-center gap-3 px-4 lg:px-6">
        {showNavToggle ? (
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--ink)] transition-colors"
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
          to="/prospectar"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)] sm:hidden transition-colors"
          aria-label={t('nav.searchClients')}
        >
          <Search className="h-4 w-4" />
        </Link>

        <Link
          to="/prospectar"
          className="group relative hidden h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] px-4 text-sm text-[color:var(--ink)] transition-all hover:border-[color:var(--border-strong)] focus:bg-[color:var(--bg-surface)] focus:outline-none sm:inline-flex sm:max-w-xs lg:max-w-sm"
          aria-label={t('nav.searchClients')}
        >
          <Search
            className="pointer-events-none h-4 w-4 shrink-0 text-[color:var(--ink-muted)]"
            aria-hidden
          />
          <span className="truncate text-sm font-normal text-[color:var(--ink-muted)]">
            {t('nav.globalSearch')}
          </span>
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
