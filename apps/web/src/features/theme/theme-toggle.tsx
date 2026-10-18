import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { useTheme } from './theme-provider';

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={cn(
        'theme-toggle theme-toggle-ios inline-flex relative h-10 w-[84px] shrink-0 items-center justify-center',
        className,
      )}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        toggleTheme({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }}
      role="switch"
      aria-checked={isDark}
      aria-label={t('nav.themeToggle')}
      data-mode={theme}
      title={isDark ? t('nav.themeToLight') : t('nav.themeToDark')}
      data-theme-toggle
    >
      <span className="theme-toggle__thumb" aria-hidden />
      <span className="theme-toggle__icon theme-toggle__sun">
        <Sun className="h-5 w-5" aria-hidden />
      </span>
      <span className="theme-toggle__icon theme-toggle__moon">
        <Moon className="h-5 w-5" aria-hidden />
      </span>
    </button>
  );
}
