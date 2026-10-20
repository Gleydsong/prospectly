import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorBoundary } from '@/components/app-error-boundary';
import { fetchClientMap, type ClientMapResult } from '@/features/leads/api';
import { renderWithProviders } from '@/test/render';
import { LeadsMapCard } from './leads-map-card';

vi.mock('@/features/leads/api', () => ({ fetchClientMap: vi.fn() }));
vi.mock('@/features/leads/components/client-map-canvas', () => ({
  default: () => <div role="region" aria-label="Client map canvas" />,
}));

beforeEach(() => vi.resetAllMocks());

describe('LeadsMapCard response recovery', () => {
  it.each([{}, null, '', { pins: [], clusters: [] }, { meta: { total: 1 } }])(
    'keeps the shell accessible for incomplete map response %j and recovers on retry',
    async (payload) => {
      vi.mocked(fetchClientMap)
        .mockResolvedValueOnce(payload as ClientMapResult)
        .mockResolvedValue({
          pins: [],
          clusters: [],
          meta: { total: 0, grouped: false, limit: 500 },
        });
      renderWithProviders(
        <AppErrorBoundary>
          <nav aria-label="Shell navigation">Clientes</nav>
          <LeadsMapCard />
        </AppErrorBoundary>,
      );

      const retry = await screen.findByRole('button', { name: /tentar novamente/i });
      expect(screen.getByRole('navigation', { name: 'Shell navigation' })).toBeVisible();
      expect(screen.queryByText('Algo deu errado')).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Client map canvas' })).not.toBeInTheDocument();

      await userEvent.click(retry);
      expect(await screen.findByRole('region', { name: 'Client map canvas' })).toBeVisible();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(fetchClientMap).toHaveBeenCalledTimes(2);
    },
  );
});
