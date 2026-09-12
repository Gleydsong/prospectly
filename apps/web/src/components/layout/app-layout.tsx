import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';

import { EmailVerificationBanner } from '@/components/email-verification-banner';
import { cn } from '@/lib/utils';
import { AppFooter } from './app-footer';
import { Sidebar } from './sidebar';
import { TopNav } from './top-nav';

const DESKTOP_NAV = '(min-width: 1024px)';
const SIDEBAR_COLLAPSED_KEY = 'prospectly:sidebar-collapsed';

function readDesktop(): boolean {
  return window.matchMedia(DESKTOP_NAV).matches;
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function persistCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Private mode can reject localStorage writes.
  }
}

export function AppLayout() {
  const { t } = useTranslation();
  const [navOpen, setNavOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(readDesktop);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readCollapsed);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_NAV);
    const sync = () => {
      setIsDesktop(media.matches);
      if (media.matches) setNavOpen(false);
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    persistCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!navOpen || isDesktop) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [navOpen, isDesktop]);

  const sidebarExpanded = isDesktop ? !sidebarCollapsed : navOpen;

  return (
    <div className="flex min-h-dvh bg-[color:var(--bg-app)]">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[80] focus:rounded-control focus:bg-[color:var(--ink)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[color:var(--bg-app)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-sky-400"
      >
        {t('nav.skipToContent')}
      </a>
      <Sidebar
        open={navOpen}
        onClose={() => setNavOpen(false)}
        isDesktop={isDesktop}
        collapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed(true)}
      />
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col transition-[padding] duration-200 motion-reduce:transition-none',
          isDesktop && !sidebarCollapsed && 'pl-sidebar',
        )}
      >
        <TopNav
          onOpenNav={() => {
            if (isDesktop) setSidebarCollapsed(false);
            else setNavOpen(true);
          }}
          navOpen={sidebarExpanded}
          showNavToggle={!isDesktop || sidebarCollapsed}
          isDesktop={isDesktop}
        />
        <EmailVerificationBanner />
        <main id="conteudo-principal" tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 lg:px-6">
          <Outlet />
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
