import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import { SupportPage } from './support-page';

describe('SupportPage', () => {
  const assignMock = vi.fn();

  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    assignMock.mockReset();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { assign: assignMock },
    });

    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'ana@agency.dev',
        name: 'Ana',
        role: 'OWNER',
        emailVerifiedAt: '2026-01-01T00:00:00.000Z',
        organizationId: 'org1',
        organizationName: 'Agência Norte Digital',
        locale: 'pt',
      } as never,
      accessToken: 'token',
      bootstrapped: true,
    });
  });

  it('renders support header, topic pills, form and FAQs', () => {
    renderWithProviders(<SupportPage />, {
      initialEntries: ['/support'],
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Como podemos ajudar?' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Abrir pedido' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créditos e PIX' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Busca' })).toBeInTheDocument();
    expect(screen.getByLabelText('Resumo')).toBeInTheDocument();
    expect(screen.getByLabelText('Detalhes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir e-mail de suporte' })).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 2, name: 'Perguntas frequentes' })).toBeInTheDocument();
    expect(screen.getByText('Quanto custa uma busca?')).toBeInTheDocument();
    expect(screen.getByText('Respondemos pelo seu e-mail.')).toBeInTheDocument();
    expect(screen.getByTestId('signal-ring')).toBeInTheDocument();
  });

  it('opens mailto link on valid form submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SupportPage />, {
      initialEntries: ['/support'],
    });

    await user.type(screen.getByLabelText('Resumo'), 'Dúvida sobre créditos');
    await user.type(screen.getByLabelText('Detalhes'), 'Paguei o PIX mas os créditos não entraram');
    await user.click(screen.getByRole('button', { name: 'Abrir e-mail de suporte' }));

    expect(assignMock).toHaveBeenCalledWith(expect.stringMatching(/^mailto:/));
    expect(assignMock.mock.calls[0][0]).toContain(encodeURIComponent('Dúvida sobre créditos'));
    expect(screen.getByText('Seu aplicativo de e-mail foi aberto!')).toBeInTheDocument();
  });

  it('toggles FAQ item on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SupportPage />, {
      initialEntries: ['/support'],
    });

    const faqButton = screen.getByRole('button', { name: /Quanto custa uma busca\?/ });
    expect(screen.queryByText(/Cada busca de clientes consome 14 créditos/)).not.toBeInTheDocument();

    await user.click(faqButton);
    expect(screen.getByText(/Cada busca de clientes consome 14 créditos/)).toBeInTheDocument();
  });
});
