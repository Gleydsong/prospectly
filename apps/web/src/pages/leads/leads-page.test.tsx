import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import type { SavedView } from '@/features/saved-views/api';
import { LeadStatus, Role } from '@/types';

import { LeadsPage } from './leads-page';

const mocks = vi.hoisted(() => ({
  useLeads: vi.fn(),
  useDeleteLead: vi.fn(),
  useCreateLead: vi.fn(),
  useBillingStatus: vi.fn(),
  useSavedViews: vi.fn(),
  useSavedView: vi.fn(),
  useCreateSavedView: vi.fn(),
  useUpdateSavedView: vi.fn(),
  useDuplicateSavedView: vi.fn(),
  useArchiveSavedView: vi.fn(),
  usePreviewSavedView: vi.fn(),
  exportLeadsCsv: vi.fn(),
  downloadCsvFile: vi.fn(),
  useFunnelConversionLeads: vi.fn(),
  useCustomFields: vi.fn(),
}));

vi.mock('@/features/leads/hooks', () => ({
  useLeads: (...args: unknown[]) => mocks.useLeads(...args),
  useDeleteLead: (...args: unknown[]) => mocks.useDeleteLead(...args),
  useCreateLead: (...args: unknown[]) => mocks.useCreateLead(...args),
}));

vi.mock('@/features/billing/hooks', () => ({
  BILLING_STATUS_QUERY_KEY: ['billing', 'status'],
  useBillingStatus: (...args: unknown[]) => mocks.useBillingStatus(...args),
}));

vi.mock('@/features/reports/hooks', () => ({
  useFunnelConversionLeads: (...args: unknown[]) => mocks.useFunnelConversionLeads(...args),
}));

vi.mock('@/features/custom-fields/hooks', () => ({
  useCustomFields: (...args: unknown[]) => mocks.useCustomFields(...args),
}));

vi.mock('@/features/saved-views/hooks', () => ({
  useSavedViews: (...args: unknown[]) => mocks.useSavedViews(...args),
  useSavedView: (...args: unknown[]) => mocks.useSavedView(...args),
  useCreateSavedView: (...args: unknown[]) => mocks.useCreateSavedView(...args),
  useUpdateSavedView: (...args: unknown[]) => mocks.useUpdateSavedView(...args),
  useDuplicateSavedView: (...args: unknown[]) => mocks.useDuplicateSavedView(...args),
  useArchiveSavedView: (...args: unknown[]) => mocks.useArchiveSavedView(...args),
  usePreviewSavedView: (...args: unknown[]) => mocks.usePreviewSavedView(...args),
}));

vi.mock('@/features/leads/api', async () => {
  const actual =
    await vi.importActual<typeof import('@/features/leads/api')>('@/features/leads/api');
  return {
    ...actual,
    exportLeadsCsv: (...args: unknown[]) => mocks.exportLeadsCsv(...args),
    downloadCsvFile: (...args: unknown[]) => mocks.downloadCsvFile(...args),
  };
});

const viewFixture: SavedView = {
  id: 'view-1',
  name: 'Lisboa sem site',
  description: null,
  visibility: 'TEAM',
  resourceType: 'LEAD',
  definition: { hasWebsite: false, city: 'Lisboa' },
  archivedAt: null,
  ownerId: 'u1',
  createdAt: '2026-09-05T12:00:00.000Z',
  updatedAt: '2026-09-05T12:00:00.000Z',
  canEdit: true,
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

describe('LeadsPage saved views', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    vi.clearAllMocks();
    setUser();
    mocks.useLeads.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 15, total: 0, totalPages: 1 } },
      isLoading: false,
      isError: false,
    });
    mocks.useDeleteLead.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      variables: undefined,
    });
    mocks.useCreateLead.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    mocks.useBillingStatus.mockReturnValue({
      data: { canExportCsv: true },
      isLoading: false,
      isError: false,
    });
    mocks.useSavedViews.mockReturnValue({
      data: [viewFixture],
      isLoading: false,
      isError: false,
    });
    mocks.useSavedView.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    mocks.useCreateSavedView.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ ...viewFixture, id: 'view-new', name: 'Novos' }),
      isPending: false,
    });
    mocks.useUpdateSavedView.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(viewFixture),
      isPending: false,
    });
    mocks.useDuplicateSavedView.mockReturnValue({
      mutateAsync: vi
        .fn()
        .mockResolvedValue({ ...viewFixture, id: 'view-2', name: 'Lisboa sem site (cópia)' }),
      isPending: false,
    });
    mocks.useArchiveSavedView.mockReturnValue({
      mutateAsync: vi
        .fn()
        .mockResolvedValue({ ...viewFixture, archivedAt: '2026-09-05T13:00:00.000Z' }),
      isPending: false,
    });
    mocks.usePreviewSavedView.mockReturnValue({
      data: { total: 7 },
      isLoading: false,
      isError: false,
    });
    mocks.exportLeadsCsv.mockResolvedValue({
      filename: 'leads.csv',
      csv: 'companyName\nAcme',
      rowCount: 1,
      columns: ['companyName'],
    });
    mocks.useFunnelConversionLeads.mockReturnValue({
      data: undefined,
      isLoading: false,
      isSuccess: false,
      isError: false,
    });
    mocks.useCustomFields.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
  });

  it('applies ?view= filters to the lead list and shows the count preview', async () => {
    renderWithProviders(<LeadsPage />, {
      initialEntries: ['/leads?view=view-1'],
      withGoogle: false,
    });

    expect(screen.getByLabelText('Vistas')).toHaveValue('view-1');
    expect(screen.getByText('7 clientes nesta vista')).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.useLeads).toHaveBeenCalledWith(
        expect.objectContaining({ hasWebsite: false, city: 'Lisboa' }),
        expect.anything(),
      );
    });
  });

  it('saves the current filters as a named view', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const mutateAsync = vi
      .fn()
      .mockResolvedValue({ ...viewFixture, id: 'view-new', name: 'Novos' });
    mocks.useCreateSavedView.mockReturnValue({ mutateAsync, isPending: false });

    renderWithProviders(<LeadsPage />, { initialEntries: ['/leads'], withGoogle: false });

    await user.selectOptions(screen.getByLabelText('Filtrar por status'), LeadStatus.NEW);
    await user.click(screen.getByRole('button', { name: /salvar visualização|guardar vista/i }));
    const dialog = await screen.findByRole('dialog', { name: /salvar visualização da lista|guardar vista da lista/i });
    const nameInput = within(dialog).getByRole('textbox', { name: 'Nome' });
    fireEvent.change(nameInput, { target: { value: 'Clientes novos' } });
    fireEvent.change(within(dialog).getByLabelText('Visibilidade'), { target: { value: 'TEAM' } });
    await user.click(within(dialog).getByRole('button', { name: /^salvar$|^guardar$/i }));

    expect(mutateAsync).toHaveBeenCalledWith({
      name: 'Clientes novos',
      visibility: 'TEAM',
      definition: { status: LeadStatus.NEW },
    });
  });

  it('hides save and archive actions for VIEWER while still applying a team view', async () => {
    setUser(Role.VIEWER);
    renderWithProviders(<LeadsPage />, {
      initialEntries: ['/leads?view=view-1'],
      withGoogle: false,
    });

    expect(screen.queryByRole('button', { name: /salvar visualização|guardar vista/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /duplicar visualização|duplicar vista/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /salvar alterações|guardar alterações/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /arquivar visualização|arquivar vista/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Vistas')).toHaveValue('view-1');
    await waitFor(() => {
      expect(mocks.useLeads).toHaveBeenCalledWith(
        expect.objectContaining({ hasWebsite: false, city: 'Lisboa' }),
        expect.anything(),
      );
    });
  });

  it('archives the selected view', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({
      ...viewFixture,
      archivedAt: '2026-09-05T13:00:00.000Z',
    });
    mocks.useArchiveSavedView.mockReturnValue({ mutateAsync, isPending: false });

    renderWithProviders(<LeadsPage />, {
      initialEntries: ['/leads?view=view-1'],
      withGoogle: false,
    });
    await user.click(screen.getByRole('button', { name: 'Arquivar vista' }));

    expect(mutateAsync).toHaveBeenCalledWith('view-1');
  });

  it('duplicates the selected view', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({
      ...viewFixture,
      id: 'view-2',
      name: 'Lisboa sem site (cópia)',
      visibility: 'PRIVATE',
    });
    mocks.useDuplicateSavedView.mockReturnValue({ mutateAsync, isPending: false });

    renderWithProviders(<LeadsPage />, {
      initialEntries: ['/leads?view=view-1'],
      withGoogle: false,
    });
    await user.click(screen.getByRole('button', { name: 'Duplicar vista' }));

    expect(mutateAsync).toHaveBeenCalledWith('view-1');
  });

  it('lets a member duplicate a team view they cannot edit', async () => {
    setUser(Role.MEMBER);
    mocks.useSavedViews.mockReturnValue({
      data: [{ ...viewFixture, ownerId: 'other', canEdit: false }],
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<LeadsPage />, {
      initialEntries: ['/leads?view=view-1'],
      withGoogle: false,
    });

    expect(screen.getByRole('button', { name: 'Duplicar vista' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar alterações' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Arquivar vista' })).not.toBeInTheDocument();
  });

  it('updates the selected view with the current filters', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const mutateAsync = vi.fn().mockResolvedValue({
      ...viewFixture,
      name: 'Lisboa atualizada',
      definition: { hasWebsite: false, city: 'Lisboa', status: LeadStatus.NEW },
    });
    mocks.useUpdateSavedView.mockReturnValue({ mutateAsync, isPending: false });

    renderWithProviders(<LeadsPage />, {
      initialEntries: ['/leads?view=view-1'],
      withGoogle: false,
    });

    await waitFor(() => {
      expect(mocks.useLeads).toHaveBeenCalledWith(
        expect.objectContaining({ hasWebsite: false, city: 'Lisboa' }),
        expect.anything(),
      );
    });
    await user.selectOptions(screen.getByLabelText('Filtrar por status'), LeadStatus.NEW);
    await user.click(screen.getByRole('button', { name: /salvar alterações|guardar alterações/i }));
    const dialog = await screen.findByRole('dialog', { name: /atualizar visualização|atualizar vista/i });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'Lisboa atualizada' },
    });
    await user.click(within(dialog).getByRole('button', { name: /salvar alterações|guardar alterações/i }));

    expect(mutateAsync).toHaveBeenCalledWith({
      id: 'view-1',
      name: 'Lisboa atualizada',
      visibility: 'TEAM',
      definition: { hasWebsite: false, city: 'Lisboa', status: LeadStatus.NEW },
    });
  });

  it('exports CSV with the applied view filters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeadsPage />, {
      initialEntries: ['/leads?view=view-1'],
      withGoogle: false,
    });

    await waitFor(() => {
      expect(mocks.useLeads).toHaveBeenCalledWith(
        expect.objectContaining({ hasWebsite: false, city: 'Lisboa' }),
        expect.anything(),
      );
    });

    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    const dialog = screen.getByRole('dialog', { name: 'Exportar clientes filtrados' });
    await user.click(within(dialog).getByRole('button', { name: 'Exportar CSV' }));

    expect(mocks.exportLeadsCsv).toHaveBeenCalledWith(
      expect.objectContaining({ hasWebsite: false, city: 'Lisboa' }),
    );
  });

  it('saves status OR and last-contact recency as a filter AST', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const mutateAsync = vi
      .fn()
      .mockResolvedValue({ ...viewFixture, id: 'view-ast', name: 'Novos ou qualificados' });
    mocks.useCreateSavedView.mockReturnValue({ mutateAsync, isPending: false });

    renderWithProviders(<LeadsPage />, { initialEntries: ['/leads'], withGoogle: false });

    await user.selectOptions(screen.getByLabelText('Filtrar por status'), LeadStatus.NEW);
    await user.selectOptions(screen.getByLabelText('Ou este status'), LeadStatus.QUALIFIED);
    await user.selectOptions(screen.getByLabelText(/último contato|último contacto/i), 'older_than');
    await user.click(screen.getByRole('button', { name: /salvar visualização|guardar vista/i }));
    const dialog = await screen.findByRole('dialog', { name: /salvar visualização da lista|guardar vista da lista/i });
    const nameInput = within(dialog).getByRole('textbox', { name: 'Nome' });
    fireEvent.change(nameInput, { target: { value: 'Novos ou qualificados' } });
    await user.click(within(dialog).getByRole('button', { name: /^salvar$|^guardar$/i }));

    expect(mutateAsync).toHaveBeenCalledWith({
      name: 'Novos ou qualificados',
      visibility: 'PRIVATE',
      definition: {
        filter: {
          op: 'and',
          nodes: [
            {
              op: 'or',
              nodes: [
                { field: 'status', op: 'eq', value: LeadStatus.NEW },
                { field: 'status', op: 'eq', value: LeadStatus.QUALIFIED },
              ],
            },
            { field: 'lastContactAt', op: 'older_than', days: 14 },
          ],
        },
      },
    });
  });

  it('applies an AST view to the lead list and export', async () => {
    const astView: SavedView = {
      ...viewFixture,
      id: 'view-ast',
      name: 'Lisboa stale',
      definition: {
        filter: {
          op: 'and',
          nodes: [
            { field: 'hasWebsite', op: 'eq', value: false },
            { field: 'city', op: 'eq', value: 'Lisboa' },
            { field: 'lastContactAt', op: 'older_than', days: 14 },
          ],
        },
      },
    };
    mocks.useSavedViews.mockReturnValue({
      data: [astView],
      isLoading: false,
      isError: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<LeadsPage />, {
      initialEntries: ['/leads?view=view-ast'],
      withGoogle: false,
    });

    await waitFor(() => {
      expect(mocks.useLeads).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: {
            op: 'and',
            nodes: [
              { field: 'hasWebsite', op: 'eq', value: false },
              { field: 'city', op: 'eq', value: 'Lisboa' },
              { field: 'lastContactAt', op: 'older_than', days: 14 },
            ],
          },
        }),
        expect.anything(),
      );
    });

    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    const dialog = screen.getByRole('dialog', { name: 'Exportar clientes filtrados' });
    await user.click(within(dialog).getByRole('button', { name: 'Exportar CSV' }));

    expect(mocks.exportLeadsCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: {
          op: 'and',
          nodes: [
            { field: 'hasWebsite', op: 'eq', value: false },
            { field: 'city', op: 'eq', value: 'Lisboa' },
            { field: 'lastContactAt', op: 'older_than', days: 14 },
          ],
        },
      }),
    );
  });

  it('saves kanban layout with the view definition', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const mutateAsync = vi
      .fn()
      .mockResolvedValue({ ...viewFixture, id: 'view-kanban', name: 'Quadro' });
    mocks.useCreateSavedView.mockReturnValue({ mutateAsync, isPending: false });

    renderWithProviders(<LeadsPage />, { initialEntries: ['/leads'], withGoogle: false });

    await user.click(screen.getByRole('button', { name: 'Kanban' }));
    await user.click(screen.getByRole('button', { name: /salvar visualização|guardar vista/i }));
    const dialog = await screen.findByRole('dialog', { name: /salvar visualização da lista|guardar vista da lista/i });
    const nameInput = within(dialog).getByRole('textbox', { name: 'Nome' });
    fireEvent.change(nameInput, { target: { value: 'Quadro Lisboa' } });
    await user.click(within(dialog).getByRole('button', { name: /^salvar$|^guardar$/i }));

    expect(mutateAsync).toHaveBeenCalledWith({
      name: 'Quadro Lisboa',
      visibility: 'PRIVATE',
      definition: { layout: 'kanban' },
    });
  });

  it('applies a kanban view and hides a deselected table column', async () => {
    const kanbanView: SavedView = {
      ...viewFixture,
      id: 'view-board',
      name: 'Quadro',
      definition: {
        hasWebsite: false,
        layout: 'kanban',
        columns: ['companyName', 'status', 'score'],
      },
    };
    mocks.useSavedViews.mockReturnValue({
      data: [kanbanView],
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<LeadsPage />, {
      initialEntries: ['/leads?view=view-board'],
      withGoogle: false,
    });

    expect(screen.getByRole('list', { name: 'Quadro por status' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Novo' })).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.useLeads).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 50 }),
        expect.anything(),
      );
    });
  });

  it('hides city when the view columns omit it', async () => {
    const slimView: SavedView = {
      ...viewFixture,
      id: 'view-slim',
      name: 'Slim',
      definition: { columns: ['companyName', 'status'] },
    };
    mocks.useSavedViews.mockReturnValue({
      data: [slimView],
      isLoading: false,
      isError: false,
    });
    mocks.useLeads.mockReturnValue({
      data: {
        data: [
          {
            id: 'l1',
            companyName: 'Padaria Central',
            city: 'Lisboa',
            status: LeadStatus.NEW,
            source: 'MANUAL',
            score: 40,
            doNotContact: false,
            tags: [],
            createdAt: '2026-09-05T12:00:00.000Z',
            updatedAt: '2026-09-05T12:00:00.000Z',
            owner: { id: 'u1', name: 'Ana' },
            website: null,
          },
        ],
        meta: { page: 1, pageSize: 15, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<LeadsPage />, {
      initialEntries: ['/leads?view=view-slim'],
      withGoogle: false,
    });

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'Empresa' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('columnheader', { name: 'Cidade' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
  });

  it('lists only the Relatórios bucket ids and does not save a Vista', async () => {
    mocks.useFunnelConversionLeads.mockReturnValue({
      data: { bucket: 'wins', period: '30d', ids: ['lead-jan'], total: 1 },
      isLoading: false,
      isSuccess: true,
      isError: false,
    });

    renderWithProviders(<LeadsPage />, {
      initialEntries: ['/leads?reportBucket=wins&period=30d'],
      withGoogle: false,
    });

    expect(screen.getByText(/A mostrar os 1 clientes deste Relatório/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar aos Relatórios' })).toHaveAttribute(
      'href',
      '/reports',
    );
    await waitFor(() => {
      expect(mocks.useLeads).toHaveBeenCalledWith(expect.objectContaining({ ids: ['lead-jan'] }), {
        enabled: true,
      });
    });
  });

  it('does not pretend the Relatórios bucket is empty while ids are loading', async () => {
    mocks.useFunnelConversionLeads.mockReturnValue({
      data: undefined,
      isLoading: true,
      isSuccess: false,
      isError: false,
    });

    renderWithProviders(<LeadsPage />, {
      initialEntries: ['/leads?reportBucket=wins&period=30d'],
      withGoogle: false,
    });

    expect(screen.getByText(/A carregar os clientes deste Relatório/i)).toBeInTheDocument();
    expect(screen.queryByText(/A mostrar os 0 clientes/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhum cliente encontrado')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.useLeads).toHaveBeenCalledWith(expect.anything(), { enabled: false });
    });
  });

  it('forwards Relatórios source and owner to the bucket ids query', async () => {
    mocks.useFunnelConversionLeads.mockReturnValue({
      data: { bucket: 'wins', period: '30d', ids: ['lead-jan'], total: 1 },
      isLoading: false,
      isSuccess: true,
      isError: false,
    });

    renderWithProviders(<LeadsPage />, {
      initialEntries: ['/leads?reportBucket=wins&period=30d&source=MANUAL&ownerId=user-sales'],
      withGoogle: false,
    });

    expect(mocks.useFunnelConversionLeads).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'wins',
        period: '30d',
        source: 'MANUAL',
        ownerId: 'user-sales',
      }),
      { enabled: true },
    );
  });

  it('does not show an empty Relatórios list when bucket ids fail to load', async () => {
    mocks.useFunnelConversionLeads.mockReturnValue({
      data: undefined,
      isLoading: false,
      isSuccess: false,
      isError: true,
    });

    renderWithProviders(<LeadsPage />, {
      initialEntries: ['/leads?reportBucket=wins&period=30d'],
      withGoogle: false,
    });

    expect(screen.getByText('Não foi possível carregar o relatório.')).toBeInTheDocument();
    expect(screen.getByText('Erro ao carregar clientes. Tente novamente.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum cliente encontrado')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.useLeads).toHaveBeenCalledWith(expect.anything(), { enabled: false });
    });
  });

  it('lets an ephemeral list show an active custom field column and hides archived pickers', async () => {
    const nifId = '11111111-1111-4111-8111-111111111111';
    const archivedId = '33333333-3333-4333-8333-333333333333';
    mocks.useCustomFields.mockReturnValue({
      data: [
        {
          id: nifId,
          name: 'NIF',
          type: 'number',
          position: 0,
          archivedAt: null,
          options: [],
        },
        {
          id: archivedId,
          name: 'Legacy',
          type: 'text',
          position: 1,
          archivedAt: '2026-09-01T00:00:00.000Z',
          options: [],
        },
      ],
      isLoading: false,
      isError: false,
    });
    mocks.useLeads.mockReturnValue({
      data: {
        data: [
          {
            id: 'l1',
            companyName: 'Padaria Central',
            city: 'Lisboa',
            status: LeadStatus.NEW,
            source: 'MANUAL',
            score: 40,
            doNotContact: false,
            tags: [],
            createdAt: '2026-09-05T12:00:00.000Z',
            updatedAt: '2026-09-05T12:00:00.000Z',
            owner: { id: 'u1', name: 'Ana' },
            website: null,
            customFieldValues: { [nifId]: 12 },
          },
        ],
        meta: { page: 1, pageSize: 15, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
    });

    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<LeadsPage />, { initialEntries: ['/leads'], withGoogle: false });

    expect(screen.getByRole('checkbox', { name: 'NIF' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Legacy/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'NIF' }));

    expect(screen.getByRole('columnheader', { name: 'NIF' })).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('keeps an archived custom field column already on a Vista', async () => {
    const archivedId = '33333333-3333-4333-8333-333333333333';
    const archivedView: SavedView = {
      ...viewFixture,
      id: 'view-legacy',
      name: 'Legacy NIF',
      definition: { columns: ['companyName', archivedId] },
    };
    mocks.useSavedViews.mockReturnValue({
      data: [archivedView],
      isLoading: false,
      isError: false,
    });
    mocks.useCustomFields.mockReturnValue({
      data: [
        {
          id: archivedId,
          name: 'NIF antigo',
          type: 'text',
          position: 0,
          archivedAt: '2026-09-01T00:00:00.000Z',
          options: [],
        },
      ],
      isLoading: false,
      isError: false,
    });
    mocks.useLeads.mockReturnValue({
      data: {
        data: [
          {
            id: 'l1',
            companyName: 'Padaria Central',
            city: 'Lisboa',
            status: LeadStatus.NEW,
            source: 'MANUAL',
            score: 40,
            doNotContact: false,
            tags: [],
            createdAt: '2026-09-05T12:00:00.000Z',
            updatedAt: '2026-09-05T12:00:00.000Z',
            owner: { id: 'u1', name: 'Ana' },
            website: null,
            customFieldValues: { [archivedId]: 'PT123' },
          },
        ],
        meta: { page: 1, pageSize: 15, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<LeadsPage />, {
      initialEntries: ['/leads?view=view-legacy'],
      withGoogle: false,
    });

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'NIF antigo' })).toBeInTheDocument();
    });
    expect(screen.getByText('PT123')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /NIF antigo/ })).toBeChecked();
  });

  it('renders custom field badge in column selector', async () => {
    const customId = '44444444-4444-4444-4444-444444444444';
    mocks.useCustomFields.mockReturnValue({
      data: [
        {
          id: customId,
          name: 'Segmento Específico',
          type: 'text',
          position: 0,
          archivedAt: null,
          options: [],
        },
      ],
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<LeadsPage />, {
      initialEntries: ['/leads'],
      withGoogle: false,
    });

    expect(screen.getByRole('checkbox', { name: 'Segmento Específico' })).toBeInTheDocument();
    expect(screen.getByText('Personalizado')).toBeInTheDocument();
  });
});
