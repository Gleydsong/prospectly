import {
  Building2,
  CheckSquare,
  FileUp,
  KanbanSquare,
  LayoutDashboard,
  Megaphone,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/search', labelKey: 'nav.search', icon: Search },
  { to: '/imports', labelKey: 'nav.imports', icon: FileUp },
  { to: '/leads', labelKey: 'nav.leads', icon: Users },
  { to: '/pipeline', labelKey: 'nav.pipeline', icon: KanbanSquare },
  { to: '/tasks', labelKey: 'nav.tasks', icon: CheckSquare },
  { to: '/campaigns', labelKey: 'nav.campaigns', icon: Megaphone },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
] as const;

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <>
      {open ? (
        <button
          className="fixed inset-0 z-30 bg-zinc-950/70 lg:hidden"
          onClick={onClose}
          aria-label={t('nav.closeMenu')}
        />
      ) : null}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-800 bg-zinc-900 transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-800 px-5">
          <NavLink to="/" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="flex h-8 w-8 items-center justify-center rounded-control bg-brand-600 text-white">
              <Building2 className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-lg font-semibold tracking-tight text-zinc-50">Prospectly</span>
          </NavLink>
          <button
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control lg:hidden"
            onClick={onClose}
            aria-label={t('nav.closeMenu')}
          >
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-500/15 text-brand-300'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50',
                )
              }
            >
              <item.icon className="h-5 w-5" aria-hidden />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
