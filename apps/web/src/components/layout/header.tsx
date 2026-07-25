import { Building2, LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { logout } from '@/features/auth/api';
import { useAuthStore } from '@/stores/auth.store';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate();
  const { user, refreshToken, clear } = useAuthStore();

  const handleLogout = async () => {
    if (refreshToken) {
      try {
        await logout(refreshToken);
      } catch {
        // Session cleanup proceeds even if server call fails.
      }
    }
    clear();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-zinc-200 bg-white px-4 lg:px-6">
      <button className="lg:hidden" onClick={onMenuClick} aria-label="Abrir menu">
        <Menu className="h-6 w-6 text-zinc-600" />
      </button>
      <div className="flex-1" />
      <div className="hidden items-center gap-2 rounded-control bg-zinc-100 px-3 py-1.5 sm:flex">
        <Building2 className="h-4 w-4 text-zinc-500" aria-hidden />
        <span className="text-sm font-medium text-zinc-700">{user?.organizationName}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-zinc-900">{user?.name}</p>
          <p className="text-xs text-zinc-500">{user?.role}</p>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white"
          aria-hidden
        >
          {user?.name?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <button
          onClick={() => void handleLogout()}
          className="rounded-control p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Sair"
          title="Sair"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
