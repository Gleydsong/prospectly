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
    await user.click(screen.getByRole('button', { name: 'Guardar vista' }));
    const dialog = await screen.findByRole('dialog', { name: 'Guardar vista da lista' });
    const nameInput = within(dialog).getByRole('textbox', { name: 'Nome' });
    fireEvent.change(nameInput, { target: { value: 'Clientes novos' } });
    fireEvent.change(within(dialog).getByLabelText('Visibilidade'), { target: { value: 'TEAM' } });
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

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

    expect(screen.queryByRole('button', { name: 'Guardar vista' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duplicar vista' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar alterações' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Arquivar vista' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Vistas')).toHaveValue('view-1');
    await waitFor(() => {
      expect(mocks.useLeads).toHaveBeenCalledWith(
        expect.objectContaining({ hasWebsite: false, city: 'Lisboa' }),
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
      );
    });
    await user.selectOptions(screen.getByLabelText('Filtrar por status'), LeadStatus.NEW);
    await user.click(screen.getByRole('button', { name: 'Guardar alterações' }));
    const dialog = await screen.findByRole('dialog', { name: 'Atualizar vista' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'Lisboa atualizada' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Guardar alterações' }));

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
      );
    });

    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    const dialog = screen.getByRole('dialog', { name: 'Exportar clientes filtrados' });
    await user.click(within(dialog).getByRole('button', { name: 'Exportar CSV' }));

    expect(mocks.exportLeadsCsv).toHaveBeenCalledWith(
      expect.objectContaining({ hasWebsite: false, city: 'Lisboa' }),
    );
  });
});
