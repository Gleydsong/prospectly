import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/i18n';
import { TasksPage } from './tasks-page';

const mocks = vi.hoisted(() => ({
  useTasks: vi.fn(),
  useCreateTask: vi.fn(),
  useUpdateTask: vi.fn(),
  useDeleteTask: vi.fn(),
  deleteTaskAsync: vi.fn(),
}));

vi.mock('@/features/tasks/hooks', () => ({
  useTasks: mocks.useTasks,
  useCreateTask: mocks.useCreateTask,
  useUpdateTask: mocks.useUpdateTask,
  useDeleteTask: mocks.useDeleteTask,
}));

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCreateTask.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.useUpdateTask.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.useDeleteTask.mockReturnValue({
      mutateAsync: mocks.deleteTaskAsync,
      isPending: false,
      variables: undefined,
    });
    mocks.useTasks.mockReturnValue({
      isLoading: false,
      data: {
        data: [
          {
            id: 'task-1',
            title: 'Contato',
            dueAt: '2026-08-14T12:00:00.000Z',
            priority: 'MEDIUM',
            status: 'OPEN',
            lead: { id: 'lead-1', companyName: 'Medic Saúde' },
            createdAt: '2026-08-10T12:00:00.000Z',
          },
        ],
        meta: { page: 1, pageSize: 15, total: 1, totalPages: 1 },
      },
    });
  });

  it('deletes the task even when it is linked to a client', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.deleteTaskAsync.mockResolvedValue({});

    render(
      <Wrapper>
        <TasksPage />
      </Wrapper>,
    );

    const buttons = screen.getAllByRole('button', { name: /apagar tarefa contato/i });
    expect(buttons.length).toBeGreaterThan(0);
    await user.click(buttons[0]!);
    expect(mocks.deleteTaskAsync).toHaveBeenCalledWith('task-1');
  });

  it('deletes an orphan task from the actions column', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.deleteTaskAsync.mockResolvedValue({});
    mocks.useTasks.mockReturnValue({
      isLoading: false,
      data: {
        data: [
          {
            id: 'task-1',
            title: 'Contato',
            dueAt: '2026-08-14T12:00:00.000Z',
            priority: 'HIGH',
            status: 'DONE',
            lead: null,
            createdAt: '2026-08-10T12:00:00.000Z',
          },
        ],
        meta: { page: 1, pageSize: 15, total: 1, totalPages: 1 },
      },
    });

    render(
      <Wrapper>
        <TasksPage />
      </Wrapper>,
    );

    await user.click(screen.getAllByRole('button', { name: /apagar tarefa contato/i })[0]!);
    expect(mocks.deleteTaskAsync).toHaveBeenCalledWith('task-1');
  });
});
