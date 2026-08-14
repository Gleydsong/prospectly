import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import i18n from '@/i18n';

import { SettingsShell } from './settings-shell';
import { parseSettingsTab, settingsTabPath } from './settings-tabs';

describe('parseSettingsTab', () => {
  it('defaults to account', () => {
    expect(parseSettingsTab(null)).toBe('account');
    expect(parseSettingsTab('unknown')).toBe('account');
  });

  it('accepts team and integrations', () => {
    expect(parseSettingsTab('team')).toBe('team');
    expect(parseSettingsTab('integrations')).toBe('integrations');
  });

  it('builds hub paths', () => {
    expect(settingsTabPath('account')).toBe('/settings');
    expect(settingsTabPath('team')).toBe('/settings?tab=team');
  });
});

describe('SettingsShell', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
  });

  it('marks the active section and hides integrations for members', () => {
    render(
      <MemoryRouter>
        <SettingsShell active="account">conteúdo</SettingsShell>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Conta' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Equipe' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('link', { name: 'Integrações' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacidade' })).toHaveAttribute(
      'href',
      '/settings/privacy',
    );
  });

  it('shows integrations for admins', () => {
    render(
      <MemoryRouter>
        <SettingsShell active="integrations" showIntegrations>
          conteúdo
        </SettingsShell>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Integrações' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
