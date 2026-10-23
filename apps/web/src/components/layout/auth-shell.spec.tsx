import { render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { ThemeProvider } from '@/features/theme/theme-provider';
import i18n from '@/i18n';

import { AuthShell } from './auth-shell';

describe('AuthShell', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('pt');
  });

  it('renders form title, trust signals, and brand panel across desktop and mobile', () => {
    render(
      <ThemeProvider>
        <AuthShell title="Entrar no Prospectly" subtitle="Acesse seu pipeline">
          <form>
            <button type="submit">Entrar</button>
          </form>
        </AuthShell>
      </ThemeProvider>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Entrar no Prospectly' }),
    ).toBeInTheDocument();
    expect(screen.getByText('SSL seguro')).toBeInTheDocument();
    expect(screen.getByText('Fluxo alinhado à LGPD')).toBeInTheDocument();
    expect(screen.getByText('Comece grátis')).toBeInTheDocument();

    const aside = screen.getByRole('complementary', { name: 'Apresentação do produto' });
    expect(aside).toBeInTheDocument();

    // Bloco desktop com escopo: h2 com o manifesto da marca
    const desktopBlock = within(aside).getByTestId('auth-shell-desktop');
    expect(
      within(desktopBlock).getByRole('heading', {
        level: 2,
        name: /Ache empresas locais sem site/i,
      }),
    ).toBeInTheDocument();

    // Bloco mobile afirmado separadamente
    const mobileBlock = within(aside).getByTestId('auth-shell-mobile');
    expect(
      within(mobileBlock).getByText(/Ache empresas locais sem site/i),
    ).toBeInTheDocument();

    expect(screen.getByRole('switch', { name: /tema/i })).toBeInTheDocument();
  });
});
