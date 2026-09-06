import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ALL, QUICK, ToolsPage } from './tools-page';

describe('ToolsPage', () => {
  it('adds Opportunity Finder to the existing tools page without removing existing tools', () => {
    render(<MemoryRouter><ToolsPage /></MemoryRouter>);
    expect(screen.getAllByRole('link', { name: /Localizador de Oportunidades com IA/i })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /Busca de clientes/i }).length).toBeGreaterThan(0);
    expect(QUICK.some((tool) => tool.to === '/tools/opportunity-finder')).toBe(true);
    expect(ALL.some((tool) => tool.to === '/agents/whatsapp')).toBe(true);
    expect(ALL.some((tool) => tool.to === '/reports')).toBe(true);
    expect(ALL.every((tool) => !QUICK.some((quick) => quick.to === tool.to))).toBe(true);
  });
});
