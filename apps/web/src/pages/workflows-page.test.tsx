import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import type { Workflow } from '@/features/workflows/api';
import { Role } from '@/types';

import { WorkflowsPage } from './workflows-page';

const mocks = vi.hoisted(() => ({
  useWorkflows: vi.fn(),
  useCreateWorkflow: vi.fn(),
  useUpdateWorkflow: vi.fn(),
  usePublishWorkflow: vi.fn(),
  usePauseWorkflow: vi.fn(),
  useResumeWorkflow: vi.fn(),
  useArchiveWorkflow: vi.fn(),
}));

vi.mock('@/features/workflows/hooks', () => ({
  useWorkflows: (...args: unknown[]) => mocks.useWorkflows(...args),
  useCreateWorkflow: (...args: unknown[]) => mocks.useCreateWorkflow(...args),
  useUpdateWorkflow: (...args: unknown[]) => mocks.useUpdateWorkflow(...args),
  usePublishWorkflow: (...args: unknown[]) => mocks.usePublishWorkflow(...args),
  usePauseWorkflow: (...args: unknown[]) => mocks.usePauseWorkflow(...args),
  useResumeWorkflow: (...args: unknown[]) => mocks.useResumeWorkflow(...args),
  useArchiveWorkflow: (...args: unknown[]) => mocks.useArchiveWorkflow(...args),
}));

const draftFixture: Workflow = {
  id: 'wf-1',
  name: 'Novos leads',
  description: null,
  status: 'DRAFT',
  draftDefinition: {
    trigger: { type: 'lead.created' },
    steps: [{ type: 'add_tag', tagName: 'alto-potencial' }],
  },
  publishedVersion: null,
  archivedAt: null,
  ownerId: 'u1',
  createdAt: '2026-09-05T18:00:00.000Z',
  updatedAt: '2026-09-05T18:00:00.000Z',
  canEdit: true,
  executesToday: false,
};

function setUser(role: Role = Role.OWNER) {
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'a@b.com',
      name: 'Ana',
      role,
      emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      organizationId: 'org1',
      organizationName: 'Acme',
      locale: 'pt',
    },
    accessToken: 'token',
    bootstrapped: true,
  });
}

function idleMutation() {
  return { mutateAsync: vi.fn(), isPending: false };
}

describe('WorkflowsPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    vi.clearAllMocks();
    setUser();
    mocks.useWorkflows.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.useCreateWorkflow.mockReturnValue(idleMutation());
    mocks.useUpdateWorkflow.mockReturnValue(idleMutation());
    mocks.usePublishWorkflow.mockReturnValue(idleMutation());
    mocks.usePauseWorkflow.mockReturnValue(idleMutation());
    mocks.useResumeWorkflow.mockReturnValue(idleMutation());
    mocks.useArchiveWorkflow.mockReturnValue(idleMutation());
  });

  it('renders empty state', () => {
    renderWithProviders(<WorkflowsPage />, { withGoogle: false });
    expect(screen.getByText('Nenhum fluxo ainda')).toBeInTheDocument();
    expect(
      screen.getByText(/A execução \(aplicar a etiqueta\) chega no próximo recorte/i),
    ).toBeInTheDocument();
  });

  it('creates a draft Fluxo and publishes it', async () => {
    const user = userEvent.setup();
    const createAsync = vi.fn().mockResolvedValue(draftFixture);
    const publishAsync = vi.fn().mockResolvedValue({
      ...draftFixture,
      status: 'ACTIVE',
      executesToday: false,
    });
    mocks.useCreateWorkflow.mockReturnValue({ mutateAsync: createAsync, isPending: false });
    mocks.usePublishWorkflow.mockReturnValue({ mutateAsync: publishAsync, isPending: false });
    renderWithProviders(<WorkflowsPage />, { withGoogle: false });

    await user.click(screen.getAllByRole('button', { name: 'Novo fluxo' })[0]!);
    await user.type(screen.getByLabelText('Nome'), 'Novos leads');
    await user.type(screen.getByLabelText('Etiqueta'), 'alto-potencial');
    await user.selectOptions(screen.getByLabelText('Quem entra'), 'noWebsite');
    await user.click(screen.getByRole('button', { name: 'Publicar' }));

    expect(createAsync).toHaveBeenCalledWith({
      name: 'Novos leads',
      description: undefined,
      definition: {
        trigger: { type: 'lead.created' },
        filter: { field: 'hasWebsite', op: 'eq', value: false },
        steps: [{ type: 'add_tag', tagName: 'alto-potencial' }],
      },
    });
    expect(publishAsync).toHaveBeenCalledWith('wf-1');
  });

  it('hides create and publish actions for VIEWER', () => {
    setUser(Role.VIEWER);
    mocks.useWorkflows.mockReturnValue({
      data: [{ ...draftFixture, canEdit: false }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderWithProviders(<WorkflowsPage />, { withGoogle: false });
    expect(screen.queryByRole('button', { name: 'Novo fluxo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();
    expect(screen.getByText('Novos leads')).toBeInTheDocument();
  });
});
