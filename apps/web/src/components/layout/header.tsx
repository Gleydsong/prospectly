import { Building2, LogOut, Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { logout } from '@/features/auth/api';
import { ThemeToggle } from '@/features/theme/theme-toggle';
import { useAuthStore } from '@/stores/auth.store';
import { routeTitleKey } from './nav-items';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, clear } = useAuthStore();
  const titleKey = routeTitleKey(pathname);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Session cleanup proceeds even if server call fails.
    }
    clear();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/[0.08] bg-zinc-950/80 px-4 backdrop-blur-xl lg:px-6">
      <button
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-zinc-300 hover:bg-white/[0.06] lg:hidden"
        onClick={onMenuClick}
        aria-label={t('nav.openMenu')}
      >
        <Menu className="h-6 w-6" />
      </button>

      {titleKey ? (
        <p className="truncate text-sm font-medium text-zinc-300">{t(titleKey)}</p>
      ) : null}

      <div className="flex-1" />

      <div className="hidden items-center gap-2 rounded-control border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 sm:flex">
        <Building2 className="h-4 w-4 text-zinc-400" aria-hidden />
        <span className="text-sm font-medium text-zinc-200">{user?.organizationName}</span>
      </div>

      <div className="flex items-center gap-1 sm:gap-3">
        <ThemeToggle />
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-zinc-50">{user?.name}</p>
          <p className="text-xs text-zinc-400">{user?.role}</p>
        </div>
        <div
          className="cta-glass flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold !shadow-none"
          aria-hidden
        >
          {user?.name?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <button
          onClick={() => void handleLogout()}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
          aria-label={t('nav.logout')}
          title={t('nav.logout')}
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
