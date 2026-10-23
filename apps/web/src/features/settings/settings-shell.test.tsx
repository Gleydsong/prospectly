import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import i18n from '@/i18n';

import { SettingsShell } from './settings-shell';
import { parseSettingsTab, settingsTabPath } from './settings-tabs';

describe('parseSettingsTab', () => {
  it('defaults to organization', () => {
    expect(parseSettingsTab(null)).toBe('organization');
    expect(parseSettingsTab('unknown')).toBe('organization');
  });

  it('accepts account, team, scoring, preferences and integrations', () => {
    expect(parseSettingsTab('account')).toBe('account');
    expect(parseSettingsTab('team')).toBe('team');
    expect(parseSettingsTab('scoring')).toBe('scoring');
    expect(parseSettingsTab('preferences')).toBe('preferences');
    expect(parseSettingsTab('integrations')).toBe('integrations');
  });

  it('builds hub paths', () => {
    expect(settingsTabPath('organization')).toBe('/settings');
    expect(settingsTabPath('account')).toBe('/settings?tab=account');
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
        <SettingsShell active="organization">conteúdo</SettingsShell>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Organização' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Perfil' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('link', { name: 'Integrações' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacidade' })).toHaveAttribute(
      'href',
      '/settings/privacy',
    );
    expect(screen.getByRole('link', { name: 'Campos personalizados' })).toHaveAttribute(
      'href',
      '/custom-fields',
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
