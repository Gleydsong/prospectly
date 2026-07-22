import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { LoginPage } from './login-page';

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    renderPage();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
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
