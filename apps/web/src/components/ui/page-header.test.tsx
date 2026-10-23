import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('renders title and description', () => {
    render(<PageHeader title="Clientes" description="Sua carteira ativa" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument();
    expect(screen.getByText('Sua carteira ativa')).toBeInTheDocument();
  });

  it('renders optional mono breadcrumb / eyebrow', () => {
    render(<PageHeader title="Visão Geral" breadcrumb="Workspace > Início" />);
    expect(screen.getByText('Workspace > Início')).toHaveClass('font-mono');
  });

  it('renders actions container when provided', () => {
    render(<PageHeader title="Leads" actions={<button type="button">Novo</button>} />);
    expect(screen.getByRole('button', { name: 'Novo' })).toBeInTheDocument();
  });
});
