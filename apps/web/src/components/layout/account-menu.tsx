import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { logout } from '@/features/auth/api';
import { useAuthStore } from '@/stores/auth.store';
import { UserAvatar } from './user-avatar';

export function AccountMenu({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation();
  const { user, clear } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);
  const signOut = async () => {
    try {
      await logout();
    } catch {
      /* Local session must still be cleared. */
    }
    clear();
    navigate('/login', { replace: true });
  };
  if (!user) return null;
  return (
    <div className="rounded-control bg-[color:var(--bg-subtle)] p-2">
      <div className="relative">
        <button
          ref={trigger}
          type="button"
          aria-expanded={open}
          aria-controls="account-menu"
          onClick={() => setOpen((value) => !value)}
          className="w-full cursor-pointer rounded-control p-2 text-left text-sm text-[color:var(--ink)]"
        >
          <span className="font-medium">{user.name}</span>
          <span className="block text-xs text-[color:var(--ink-secondary)]">
            {t('nav.accountHelp')}
          </span>
        </button>
        {open ? (
          <div
            id="account-menu"
            className="absolute bottom-full left-0 z-50 mb-2 w-full bg-[color:var(--bg-surface)] shadow-lg flex flex-col gap-1 rounded-control border border-[color:var(--border-default)] p-2 text-sm text-[color:var(--ink)]"
          >
            {(
              [
                ['/settings', 'nav.myAccount'],
                ['/credits', 'nav.creditsPlanMenu'],
                ['/support', 'nav.helpSupport'],
              ] as const
            ).map(([to, key]) => (
              <Link
                key={to}
                to={to}
                onClick={() => {
                  setOpen(false);
                  onNavigate();
                }}
                className="rounded-control p-2 hover:bg-[color:var(--bg-surface)]"
              >
                {t(key)}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-control p-2 text-left hover:bg-[color:var(--bg-surface)]"
            >
              {t('nav.logout')}
            </button>
          </div>
        ) : null}
      </div>
      <div className="mt-1 flex items-center gap-2 px-2">
        <UserAvatar
          onClick={onNavigate}
          name={user.name}
          avatarUrl={user.avatarUrl}
          label={t('nav.account', { name: user.name })}
        />
        <div className="min-w-0 text-xs text-[color:var(--ink-secondary)]">
          <p className="truncate">
            {user.effectivePersona === 'outro'
              ? user.personaOtherLabel?.trim() || t('persona.outro')
              : t(`persona.${user.effectivePersona ?? 'vendedor'}`)}
          </p>
          <p className="truncate">{user.email}</p>
        </div>
      </div>
    </div>
  );
}
