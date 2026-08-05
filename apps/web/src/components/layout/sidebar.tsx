import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { NAV_GROUPS } from './nav-items';

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <>
      {open ? (
        <button
          className="fixed inset-0 z-30 bg-zinc-950/80 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-label={t('nav.closeMenu')}
        />
      ) : null}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/[0.08] bg-zinc-900/95 backdrop-blur-xl transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/[0.08] px-5">
          <NavLink to="/" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="cta-glass flex h-8 w-8 items-center justify-center rounded-control text-sm font-semibold">
              P
            </span>
            <span className="text-lg font-semibold tracking-tight text-zinc-50">Prospectly</span>
          </NavLink>
          <button
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100 lg:hidden"
            onClick={onClose}
            aria-label={t('nav.closeMenu')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto p-3" aria-label="Navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.labelKey} className="space-y-1">
              <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                {t(group.labelKey)}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-white/[0.07] text-zinc-50'
                        : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-400 transition-opacity',
                          isActive ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-hidden
                      />
                      <item.icon
                        className={cn('h-5 w-5', isActive ? 'text-brand-300' : 'text-current')}
                        aria-hidden
                      />
                      {t(item.labelKey)}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
