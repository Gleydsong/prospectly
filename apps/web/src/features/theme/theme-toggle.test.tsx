import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { ThemeProvider } from './theme-provider';
import { THEME_STORAGE_KEY } from './theme-storage';
import { ThemeToggle } from './theme-toggle';

beforeEach(() => {
  localStorage.removeItem(THEME_STORAGE_KEY);
  document.documentElement.className = 'light';
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
});

afterEach(async () => {
  cleanup();
  localStorage.removeItem(THEME_STORAGE_KEY);
  document.documentElement.className = 'light';
  vi.unstubAllGlobals();
  await i18n.changeLanguage('pt');
});

describe('Day/Night theme switch', () => {
  it('switches using the keyboard, persists and restores after remount with reduced motion', async () => {
    const transition = vi.fn();
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: transition,
    });
    const user = userEvent.setup();
    const view = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const toggle = screen.getByRole('switch', { name: 'Tema Dia/Noite' });
    expect(toggle).not.toBeChecked();
    expect(toggle.querySelectorAll('svg')).toHaveLength(2);
    await user.tab();
    await user.keyboard(' ');
    expect(toggle).toBeChecked();
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(transition).not.toHaveBeenCalled();
    view.unmount();
    document.documentElement.className = '';
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(screen.getByRole('switch')).toBeChecked();
    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(document.documentElement).toHaveClass('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    Reflect.deleteProperty(document, 'startViewTransition');
  });

  it('provides English labels', async () => {
    await i18n.changeLanguage('en');
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(screen.getByRole('switch', { name: 'Day/Night theme' })).toHaveAttribute(
      'title',
      'Switch to Night theme',
    );
  });
});
