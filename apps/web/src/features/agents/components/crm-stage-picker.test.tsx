import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { CrmStagePicker } from './crm-stage-picker';

const mocks = vi.hoisted(() => ({
  fetchPipelines: vi.fn(),
}));

vi.mock('@/features/pipeline/api', () => ({
  fetchPipelines: (...args: unknown[]) => mocks.fetchPipelines(...args),
}));

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('CrmStagePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchPipelines.mockResolvedValue([
      {
        id: 'pipeline-1',
        name: 'Funil Principal',
        isDefault: true,
        stages: [
          { id: 's-1', name: 'Novo', order: 0 },
          { id: 's-2', name: 'Contato Feito', order: 1 },
          { id: 's-3', name: 'Negociação', order: 2 },
        ],
      },
    ]);
  });

  it('lists pipeline stages and marks the current one as disabled', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <CrmStagePicker currentStageId="s-1" onSelect={vi.fn()} />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: /mover estágio/i }));

    expect(await screen.findByRole('menuitem', { name: 'Contato Feito' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Novo' })).toBeDisabled();
  });

  it('calls onSelect and closes when a stage is chosen', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <Wrapper>
        <CrmStagePicker currentStageId="s-1" onSelect={onSelect} />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: /mover estágio/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Negociação' }));

    expect(onSelect).toHaveBeenCalledWith('s-3');
    expect(screen.getByRole('button', { name: /mover estágio/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <CrmStagePicker currentStageId="s-1" onSelect={vi.fn()} />
      </Wrapper>,
    );

    const trigger = screen.getByRole('button', { name: /mover estágio/i });
    await user.click(trigger);
    await screen.findByRole('menuitem', { name: 'Contato Feito' });

    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
  });
});
