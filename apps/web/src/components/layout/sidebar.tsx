import { PanelLeftClose, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import prospectlyMark from '@/assets/prospectly-mark-v2.svg';
import { secondaryNavGroups, TOP_NAV_ITEMS } from './nav-items';
import { UserAvatar } from './user-avatar';

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
  const user = useAuthStore((state) => state.user);
  const closeRef = useRef<HTMLButtonElement>(null);
  const expanded = isDesktop ? !collapsed : open;
  const secondary = secondaryNavGroups();

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
        {...(!expanded ? { inert: '' } : {})}
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-sidebar flex-col border-r border-[color:var(--border-default)] bg-[color:var(--bg-sidebar)] transition-transform duration-200 motion-reduce:transition-none',
          expanded ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-[color:var(--border-default)] px-4">
          <NavLink
            to="/"
            aria-label="Prospectly"
            className="inline-flex min-w-0 items-center gap-0 text-[15px] font-semibold tracking-tight text-[color:var(--ink)]"
            onClick={onClose}
          >
            <img src={prospectlyMark} alt="" aria-hidden className="-ml-0.5 h-7 w-7 shrink-0" />
            <span className="-ml-0.5 truncate leading-none">rospectly</span>
          </NavLink>
          {isDesktop ? (
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-control text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--ink)]"
              onClick={onCollapse}
              aria-label={t('nav.hideSidebar')}
              title={t('nav.hideSidebar')}
            >
              <PanelLeftClose className="h-5 w-5" aria-hidden />
            </button>
          ) : (
            <button
              ref={closeRef}
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-control text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--ink)]"
              onClick={onClose}
              aria-label={t('nav.closeMenu')}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto p-3" aria-label={t('nav.mainNav')}>
          <div className="space-y-0.5">
            {TOP_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onClose}
                tabIndex={expanded ? undefined : -1}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center gap-2.5 rounded-control px-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[color:var(--bg-nav-active)] font-semibold text-[color:var(--brand-hover)]'
                      : 'text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--ink)]',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn(
                        'h-4 w-4',
                        isActive ? 'text-[color:var(--brand)]' : 'text-[color:var(--ink-muted)]',
                      )}
                      aria-hidden
                    />
                    {t(item.labelKey)}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {secondary.map((group) => (
            <div key={group.labelKey} className="space-y-0.5">
              <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--ink-secondary)]">
                {t(group.labelKey)}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={`${group.labelKey}-${item.to}`}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onClose}
                  tabIndex={expanded ? undefined : -1}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center gap-2.5 rounded-control px-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-[color:var(--bg-nav-active)] font-semibold text-[color:var(--brand-hover)]'
                        : 'text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--ink)]',
                    )
                  }
                >
                  <item.icon className="h-4 w-4 text-[color:var(--ink-muted)]" aria-hidden />
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {user ? (
          <div className="border-t border-[color:var(--border-default)] p-3">
            <div className="flex items-center gap-2.5 rounded-control px-1.5 py-1">
              <UserAvatar
                name={user.name}
                avatarUrl={user.avatarUrl}
                label={t('nav.account', { name: user.name })}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[color:var(--ink)]">{user.name}</p>
                <p className="truncate text-xs text-[color:var(--ink-secondary)]">{user.email}</p>
              </div>
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
