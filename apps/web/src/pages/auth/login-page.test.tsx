import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { LoginPage } from './login-page';

const renderPage = () => renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

describe('LoginPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('pt');
  });

  it('renders email and password fields', () => {
    renderPage();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Esqueci a senha' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('validates email format before submit', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('E-mail'), 'not-an-email');
    await user.type(screen.getByLabelText('Senha'), 'secret1');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('E-mail inválido')).toBeInTheDocument();
  });

  it('requires password', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('E-mail'), 'demo@prospectly.dev');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Senha obrigatória')).toBeInTheDocument();
  });
});
