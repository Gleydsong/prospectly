import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { NotFoundPage } from './not-found-page';

describe('NotFoundPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
  });

  it('renders 404 graphic, headings and return to home button', () => {
    renderWithProviders(<NotFoundPage />, {
      withGoogle: false,
      initialEntries: ['/non-existent-route'],
    });

    expect(screen.getByText('Esta página saiu do mapa.')).toBeInTheDocument();
    expect(
      screen.getByText('O endereço pode ter mudado ou você não tem acesso a ele.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar ao Início' })).toBeInTheDocument();
    expect(screen.getByTestId('signal-ring')).toBeInTheDocument();
    expect(screen.getByTestId('gloss-sphere')).toBeInTheDocument();
  });
});
