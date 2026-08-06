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
        'theme-toggle theme-toggle-ios inline-flex h-11 w-11 shrink-0 items-center justify-center',
        className,
      )}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        toggleTheme({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }}
      aria-label={isDark ? t('nav.themeToLight') : t('nav.themeToDark')}
      title={isDark ? t('nav.themeToLight') : t('nav.themeToDark')}
      data-theme-toggle
    >
      {isDark ? <Moon className="h-5 w-5" aria-hidden /> : <Sun className="h-5 w-5" aria-hidden />}
    </button>
  );
}
