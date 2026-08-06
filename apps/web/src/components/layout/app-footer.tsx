import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { TOP_NAV_ITEMS } from './nav-items';

export function AppFooter() {
  const { t } = useTranslation();

  return (
    <footer className="mt-10 border-t border-[color:var(--border)] py-8">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link to="/" className="text-sm font-bold text-[color:var(--ink)]">
            prospectly<span className="text-[color:var(--accent)]">.</span>
          </Link>
          {TOP_NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm text-[color:var(--ink-muted)] transition-colors hover:text-[color:var(--ink)]"
            >
              {t(item.labelKey)}
            </Link>
          ))}
          <Link
            to="/settings"
            className="text-sm text-[color:var(--ink-muted)] transition-colors hover:text-[color:var(--ink)]"
          >
            {t('nav.settings')}
          </Link>
        </div>
        <p className="text-xs text-[color:var(--ink-muted)]">© {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
