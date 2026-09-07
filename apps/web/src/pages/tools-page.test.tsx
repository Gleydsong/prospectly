import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import i18n from '@/i18n';
import { useAuthStore } from '@/stores/auth.store';
import { Role } from '@/types';

import { ALL, ORG_SCHEMA, QUICK, ToolsPage } from './tools-page';

function setUser(role: Role) {
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'a@b.com',
      name: 'Ana',
      role,
      emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      organizationId: 'org1',
      organizationName: 'Acme',
      locale: 'pt',
    },
    accessToken: 'token',
    bootstrapped: true,
  });
}

describe('ToolsPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    setUser(Role.OWNER);
  });

  it('adds Opportunity Finder to the existing tools page without removing existing tools', () => {
    render(
      <MemoryRouter>
        <ToolsPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('link', { name: /Localizador de Oportunidades com IA/i })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /Busca de clientes/i }).length).toBeGreaterThan(0);
    expect(QUICK.some((tool) => tool.to === '/tools/opportunity-finder')).toBe(true);
    expect(ALL.some((tool) => tool.to === '/agents/whatsapp')).toBe(true);
    expect(ALL.some((tool) => tool.to === '/reports')).toBe(true);
    expect(ALL.every((tool) => !QUICK.some((quick) => quick.to === tool.to))).toBe(true);
  });

  it('shows custom fields in Ferramentas for OWNER, not in Converter quick access', () => {
    render(
      <MemoryRouter>
        <ToolsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Campos personalizados/i })).toHaveAttribute(
      'href',
      '/custom-fields',
    );
    expect(QUICK.some((tool) => tool.to === '/custom-fields')).toBe(false);
    expect(ORG_SCHEMA.some((tool) => tool.to === '/custom-fields')).toBe(true);
  });

  it('hides the custom fields card from VIEWER', () => {
    setUser(Role.VIEWER);
    render(
      <MemoryRouter>
        <ToolsPage />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: /Campos personalizados/i })).not.toBeInTheDocument();
  });
});

