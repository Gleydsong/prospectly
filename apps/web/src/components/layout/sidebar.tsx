import {
  Building2,
  CheckSquare,
  FileUp,
  KanbanSquare,
  LayoutDashboard,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/search', label: 'Pesquisa', icon: Search },
  { to: '/imports', label: 'Importar CSV', icon: FileUp },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { to: '/tasks', label: 'Tarefas', icon: CheckSquare },
  { to: '/settings', label: 'Configurações', icon: Settings },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open ? (
        <button
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={onClose}
          aria-label="Fechar menu"
        />
      ) : null}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <NavLink to="/" className="flex items-center gap-2" onClick={onClose}>
            <Building2 className="h-6 w-6 text-brand-600" aria-hidden />
            <span className="text-lg font-bold text-slate-900">Prospectly</span>
          </NavLink>
          <button className="lg:hidden" onClick={onClose} aria-label="Fechar menu lateral">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              <item.icon className="h-5 w-5" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
