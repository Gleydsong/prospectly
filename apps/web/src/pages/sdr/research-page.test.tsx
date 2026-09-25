import { screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { ResearchScreen } from './research-page';

describe('ResearchScreen', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('pt');
  });

  it('blocks research until the prospect is qualified', () => {
    renderWithProviders(<ResearchScreen brief={{ status: 'BLOCKED' }} />, { withGoogle: false });

    expect(
      screen.getByText('Research só começa com um prospect qualificado e evidência viva.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Observações' })).not.toBeInTheDocument();
  });

  it('shows the angle, observations, and hooks for a qualified brief', () => {
    renderWithProviders(
      <ResearchScreen
        brief={{
          status: 'READY',
          angle: 'website_problem',
          observations: [{ statement: 'ssl: absent', evidenceIds: ['ev-ssl'] }],
          hooks: ['ssl:absent'],
        }}
      />,
      { withGoogle: false },
    );

    expect(screen.getByText('Ângulo: website_problem')).toBeInTheDocument();
    expect(screen.getByText('ssl: absent (ev-ssl)')).toBeInTheDocument();
    expect(screen.getByText('ssl:absent')).toBeInTheDocument();
  });
});
