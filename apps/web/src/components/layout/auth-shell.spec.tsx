import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import i18n from '@/i18n';

import { AuthShell } from './auth-shell';

describe('AuthShell', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('pt');
  });

  it('renders form title and trust signals', () => {
    render(
      <AuthShell title="Entrar no Prospectly" subtitle="Acesse seu pipeline">
        <form>
          <button type="submit">Entrar</button>
        </form>
      </AuthShell>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Entrar no Prospectly' })).toBeInTheDocument();
    expect(screen.getByText('SSL seguro')).toBeInTheDocument();
    expect(screen.getByText('Fluxo alinhado à LGPD')).toBeInTheDocument();
    expect(screen.getByText('Comece grátis')).toBeInTheDocument();
    expect(screen.getByText(/Ache empresas locais sem site/i)).toBeInTheDocument();
  });
});
