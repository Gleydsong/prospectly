import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AppErrorBoundary } from './app-error-boundary';

function Bomb({ blow }: { blow: boolean }) {
  if (blow) {
    throw new Error('Boom from child');
  }
  return <p>Conteúdo estável</p>;
}

describe('AppErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <AppErrorBoundary>
        <Bomb blow={false} />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('Conteúdo estável')).toBeInTheDocument();
  });

  it('shows recovery UI with correlation id and recovers on try again', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { rerender } = render(
      <AppErrorBoundary correlationId="corr-test-123">
        <Bomb blow />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Algo correu mal/i)).toBeInTheDocument();
    expect(screen.getByText('corr-test-123')).toBeInTheDocument();
    expect(screen.getByText(/Boom from child/i)).toBeInTheDocument();

    // Heal the child before clearing the boundary state, otherwise it throws again.
    rerender(
      <AppErrorBoundary correlationId="corr-test-123">
        <Bomb blow={false} />
      </AppErrorBoundary>,
    );

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(screen.getByText('Conteúdo estável')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('offers a home recovery action', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppErrorBoundary correlationId="corr-home">
        <Bomb blow />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('button', { name: 'Ir para o início' })).toBeInTheDocument();
    spy.mockRestore();
  });
});
