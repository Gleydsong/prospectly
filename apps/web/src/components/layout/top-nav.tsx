import { useQuery } from '@tanstack/react-query';
import { Coins, LogOut, Menu, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useNavigate } from 'react-router-dom';

import { logout } from '@/features/auth/api';
import { getBillingStatus } from '@/features/billing/api';
import { ThemeToggle } from '@/features/theme/theme-toggle';
import { cn } from '@/lib/utils';
import { sanitizeAvatarSrc } from '@/lib/safe-url';
import { useAuthStore } from '@/stores/auth.store';
import { NAV_GROUPS, TOP_NAV_ITEMS } from './nav-items';
import prospectlyMark from '@/assets/prospectly-mark-v2.svg';

function initials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function UserAvatar({
  name,
  avatarUrl,
  label,
}: {
  name?: string;
  avatarUrl?: string | null;
  label: string;
}) {
  const [broken, setBroken] = useState(false);
  const safeAvatar = sanitizeAvatarSrc(avatarUrl);
  const showPhoto = Boolean(safeAvatar) && !broken;

  return (
    <Link
      to="/settings"
      className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--ink)] text-xs font-bold text-white ring-1 ring-[color:var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
      title={name}
      aria-label={label}
    >
      {showPhoto ? (
        <img
          src={safeAvatar!}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </Link>
  );
}

export function TopNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, clear } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

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

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    const onResize = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) setMobileOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [mobileOpen]);

  const billing = useQuery({
    queryKey: ['billing', 'status'],
    queryFn: getBillingStatus,
    staleTime: 60_000,
  });

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
    <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[var(--chrome-bg)] shadow-[0_1px_0_rgba(16,24,40,0.03)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 lg:px-6">
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-hover)] lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label={t('nav.openMenu')}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link
          to="/"
          aria-label="Prospectly"
          className="inline-flex shrink-0 items-center gap-0 text-lg font-semibold tracking-tight text-[color:var(--ink)]"
        >
          <img src={prospectlyMark} alt="" aria-hidden className="-ml-0.5 h-7 w-7 shrink-0" />
          <span className="-ml-0.5 leading-none">rospectly</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label={t('nav.mainNav')}>
          {TOP_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/50 dark:text-blue-300'
                    : 'text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--ink)]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      'h-4 w-4',
                      isActive ? 'text-blue-700 dark:text-blue-300' : 'text-current',
                    )}
                    aria-hidden
                  />
                  {t(item.labelKey)}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />

        <Link
          to="/search"
          className="group relative hidden h-9 w-[230px] shrink-0 items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-100 px-3 text-sm text-slate-800 transition-colors hover:bg-slate-100 hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:bg-slate-900 sm:inline-flex"
          aria-label={t('nav.searchClients')}
        >
          <Search
            className="pointer-events-none h-4 w-4 shrink-0 text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300 transition-colors"
            aria-hidden
          />
          <span className="truncate text-xs font-normal text-slate-400 dark:text-slate-500 sm:text-sm">
            {t('nav.globalSearch', { defaultValue: 'Busca global...' })}
          </span>
          <kbd className="ml-auto pointer-events-none inline-flex items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            ⌘K
          </kbd>
        </Link>

        <Link
          to="/credits"
          className="hidden items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100/80 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-300 sm:inline-flex"
          title={t('nav.credits')}
        >
          <Coins className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{creditsLabel}</span>
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
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--ink)]"
          aria-label={t('nav.logout')}
          title={t('nav.logout')}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {mobileOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 lg:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-[var(--chrome-overlay)] backdrop-blur-sm"
                aria-label={t('nav.closeMenu')}
                onClick={() => setMobileOpen(false)}
              />
              <aside
                id="mobile-nav"
                className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col border-r border-[color:var(--border)] bg-[var(--chrome-sidebar)] shadow-elevated"
              >
                <div className="flex h-16 items-center justify-between border-b border-[color:var(--border)] px-4">
                  <span className="inline-flex items-center gap-0 text-lg font-semibold text-[color:var(--ink)]">
                    <img
                      src={prospectlyMark}
                      alt=""
                      aria-hidden
                      className="-ml-0.5 h-7 w-7 shrink-0"
                    />
                    <span className="-ml-0.5 leading-none">rospectly</span>
                  </span>
                  <button
                    type="button"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-[color:var(--ink-muted)]"
                    onClick={() => setMobileOpen(false)}
                    aria-label={t('nav.closeMenu')}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav className="flex-1 space-y-4 overflow-y-auto p-3" aria-label={t('nav.mainNav')}>
                  <div className="space-y-1">
                    {TOP_NAV_ITEMS.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium',
                            isActive
                              ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/50 dark:text-blue-300'
                              : 'text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--ink)]',
                          )
                        }
                      >
                        <item.icon className="h-5 w-5" aria-hidden />
                        {t(item.labelKey)}
                      </NavLink>
                    ))}
                  </div>
                  {NAV_GROUPS.map((group) => (
                    <div key={group.labelKey} className="space-y-1">
                      <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                        {t(group.labelKey)}
                      </p>
                      {group.items.map((item) => (
                        <NavLink
                          key={`${group.labelKey}-${item.to}`}
                          to={item.to}
                          end={item.to === '/'}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium',
                              isActive
                                ? 'bg-[color:var(--surface-hover)] text-[color:var(--ink)]'
                                : 'text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-hover)]',
                            )
                          }
                        >
                          <item.icon className="h-4 w-4" aria-hidden />
                          {t(item.labelKey)}
                        </NavLink>
                      ))}
                    </div>
                  ))}
                </nav>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </header>
  );
}
