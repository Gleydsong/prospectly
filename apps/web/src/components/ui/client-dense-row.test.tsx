import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Badge } from '@/components/ui/badge';
import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { ScoreBadge } from '@/components/ui/score-badge';
import { renderWithProviders } from '@/test/render';
import { LeadStatus } from '@/types';

import { ClientDenseRow } from './client-dense-row';

describe('ClientDenseRow', () => {
  it('links a likely WhatsApp number and labels the channel', () => {
    renderWithProviders(
      <ClientDenseRow
        name="Farmácia do Largo"
        subtitle="Segmento · Farmácia"
        phone="(11) 99876-5432"
        email="info@farmacia.test"
        whatsappHref="https://wa.me/5511998765432"
        channel="whatsapp"
        status={<span>Qualificado</span>}
        tags={[{ id: 't1', label: 'sem-site' }]}
        primaryAction={{ label: 'Abrir', onClick: vi.fn() }}
      />,
      { withGoogle: false },
    );

    const wa = screen.getByRole('link', { name: /99876/ });
    expect(wa).toHaveAttribute('href', 'https://wa.me/5511998765432');
    expect(screen.getByText('WhatsApp (celular)')).toBeInTheDocument();
    expect(screen.getByText('FD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir' })).toBeInTheDocument();
  });

  it('does not use wa.me for a landline and prefers email as the channel', () => {
    renderWithProviders(
      <ClientDenseRow
        name="Cartório Central"
        phone="(11) 3234-5678"
        email="contato@cartorio.test"
        channel="email"
      />,
      { withGoogle: false },
    );

    expect(screen.queryByRole('link', { name: /Abrir WhatsApp/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /3234/ })).toHaveAttribute('href', 'tel:1132345678');
    expect(screen.getByRole('link', { name: /^E-mail$/ })).toHaveAttribute(
      'href',
      'mailto:contato@cartorio.test',
    );
  });

  it('toggles selection from the checkbox without activating the row', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onActivate = vi.fn();
    renderWithProviders(
      <ClientDenseRow
        name="Padaria Forno Antigo"
        channel="none"
        selected={false}
        selectable
        onToggle={onToggle}
        onActivate={onActivate}
      />,
      { withGoogle: false },
    );

    await user.click(screen.getByRole('checkbox', { name: /Selecionar Padaria Forno Antigo/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('activates the row from the keyboard', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    renderWithProviders(
      <ClientDenseRow name="Padaria Forno Antigo" channel="none" onActivate={onActivate} />,
      { withGoogle: false },
    );

    const row = screen.getByRole('button', { name: /Padaria Forno Antigo/i });
    row.focus();
    await user.keyboard('{Enter}');
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('exposes overflow actions', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderWithProviders(
      <ClientDenseRow
        name="Padaria Forno Antigo"
        channel="phone"
        phone="(11) 3234-5678"
        menuItems={[{ id: 'delete', label: 'Apagar', onClick: onDelete, danger: true }]}
      />,
      { withGoogle: false },
    );

    await user.click(screen.getByRole('button', { name: /Mais ações|More actions/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Apagar' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('keeps phone, channel and menu slots when contact data is missing', () => {
    const { container } = renderWithProviders(
      <ClientDenseRow
        name="chopperia sini bar"
        channel="none"
        primaryAction={{ label: 'Enviar para CRM', onClick: vi.fn() }}
      />,
      { withGoogle: false },
    );

    expect(container.querySelector('[data-slot="phone"]')?.textContent).toMatch(/—/);
    expect(container.querySelector('[data-slot="channel"]')?.textContent).toMatch(/—/);
    expect(container.querySelector('[data-slot="menu"]')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Mais ações|More actions/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar para CRM' })).toBeInTheDocument();
  });

  it('renders a row with all badges and tags (status, score, sem site, tags) without layout collision', () => {
    renderWithProviders(
      <ClientDenseRow
        name="Padaria Forno Antigo"
        subtitle="Padaria · Porto Alegre · RS"
        phone="(51) 99876-5432"
        email="contato@fornoantigo.com.br"
        channel="whatsapp"
        whatsappHref="https://wa.me/5551998765432"
        status={<LeadStatusBadge status={LeadStatus.QUALIFIED} />}
        extraBadges={
          <>
            <ScoreBadge score={85} />
            <Badge tone="mint" title="Sem website">
              sem site
            </Badge>
          </>
        }
        tags={[
          { id: 't1', label: 'prioridade' },
          { id: 't2', label: 'site-antigo' },
          { id: 't3', label: 'lento' },
        ]}
        primaryAction={{ label: 'Abrir', onClick: vi.fn() }}
      />,
      { withGoogle: false },
    );

    expect(screen.getByText('Padaria Forno Antigo')).toBeInTheDocument();
    expect(screen.getByText('Qualificado')).toBeInTheDocument();
    expect(screen.getByText('85 pts')).toBeInTheDocument();
    expect(screen.getByText('sem site')).toBeInTheDocument();
    expect(screen.getByText('prioridade')).toBeInTheDocument();
    expect(screen.getByText('site-antigo')).toBeInTheDocument();
    expect(screen.getByText('lento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir' })).toBeInTheDocument();
  });
});
