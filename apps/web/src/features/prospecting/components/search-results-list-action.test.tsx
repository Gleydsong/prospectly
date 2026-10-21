import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProspectingSearchResult } from '@/types';
import { renderWithProviders } from '@/test/render';
import { SearchResultsListAction } from './search-results-list-action';

const mocks = vi.hoisted(() => ({
  useCampaigns: vi.fn(),
  useAddCampaignLeads: vi.fn(),
  useImportSearchResults: vi.fn(),
}));

vi.mock('@/features/campaigns/hooks', () => ({
  useCampaigns: (...args: unknown[]) => mocks.useCampaigns(...args),
  useAddCampaignLeads: (...args: unknown[]) => mocks.useAddCampaignLeads(...args),
}));

vi.mock('@/features/prospecting/hooks', () => ({
  useImportSearchResults: (...args: unknown[]) => mocks.useImportSearchResults(...args),
}));

const result = (id: string, importedLeadId?: string): ProspectingSearchResult => ({
  id,
  importedLeadId,
  data: {} as ProspectingSearchResult['data'],
  normalizedData: {} as ProspectingSearchResult['normalizedData'],
  websitePresence: 'WEBSITE_FOUND',
  createdAt: '2026-10-20T00:00:00.000Z',
});

describe('SearchResultsListAction', () => {
  let importMutation: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
  let addMutation: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };

  beforeEach(() => {
    vi.clearAllMocks();
    importMutation = { mutateAsync: vi.fn(), isPending: false };
    addMutation = { mutateAsync: vi.fn(), isPending: false };
    mocks.useCampaigns.mockReturnValue({
      data: {
        data: [{ id: 'list-1', name: 'Padarias de Lisboa' }],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
    });
    mocks.useAddCampaignLeads.mockReturnValue(addMutation);
    mocks.useImportSearchResults.mockReturnValue(importMutation);
  });

  it('imports selected results and adds the returned client IDs to the chosen List', async () => {
    importMutation.mutateAsync.mockResolvedValue({
      imported: 1,
      skipped: 0,
      invalid: 0,
      conflicts: 0,
      items: [{ resultId: 'result-1', status: 'IMPORTED', leadId: 'lead-1' }],
    });
    addMutation.mutateAsync.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithProviders(
      <SearchResultsListAction searchId="search-1" results={[result('result-1')]} />,
    );

    await user.click(screen.getByRole('button', { name: 'Adicionar a uma Lista' }));
    await user.selectOptions(screen.getByLabelText('Lista'), 'list-1');
    await user.click(screen.getByRole('button', { name: 'Adicionar selecionados' }));

    await waitFor(() =>
      expect(addMutation.mutateAsync).toHaveBeenCalledWith({ leadIds: ['lead-1'] }),
    );
    expect(importMutation.mutateAsync).toHaveBeenCalledWith({
      searchId: 'search-1',
      resultIds: ['result-1'],
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Clientes adicionados à Lista.');
  });

  it('renders the closed action without mounting campaign or import hooks', () => {
    render(<SearchResultsListAction searchId="search-1" results={[result('result-1')]} />);

    expect(screen.getByRole('button', { name: 'Adicionar a uma Lista' })).toBeInTheDocument();
    expect(mocks.useCampaigns).not.toHaveBeenCalled();
    expect(mocks.useAddCampaignLeads).not.toHaveBeenCalled();
    expect(mocks.useImportSearchResults).not.toHaveBeenCalled();
  });

  it('keeps imported client IDs after list failure and retries without importing again', async () => {
    importMutation.mutateAsync.mockResolvedValue({
      imported: 1,
      skipped: 0,
      invalid: 0,
      conflicts: 0,
      items: [{ resultId: 'result-1', status: 'IMPORTED', leadId: 'lead-1' }],
    });
    addMutation.mutateAsync
      .mockRejectedValueOnce(new Error('list unavailable'))
      .mockResolvedValueOnce({});
    const user = userEvent.setup();
    renderWithProviders(
      <SearchResultsListAction searchId="search-1" results={[result('result-1')]} />,
    );

    await user.click(screen.getByRole('button', { name: 'Adicionar a uma Lista' }));
    await user.selectOptions(screen.getByLabelText('Lista'), 'list-1');
    await user.click(screen.getByRole('button', { name: 'Adicionar selecionados' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Adicionar selecionados' }));
    await waitFor(() => expect(addMutation.mutateAsync).toHaveBeenCalledTimes(2));
    expect(addMutation.mutateAsync).toHaveBeenLastCalledWith({ leadIds: ['lead-1'] });
    expect(importMutation.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('uses already imported selected results without calling import', async () => {
    addMutation.mutateAsync.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithProviders(
      <SearchResultsListAction
        searchId="search-1"
        results={[result('result-1', 'lead-existing')]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Adicionar a uma Lista' }));
    await user.selectOptions(screen.getByLabelText('Lista'), 'list-1');
    await user.click(screen.getByRole('button', { name: 'Adicionar selecionados' }));

    await waitFor(() =>
      expect(addMutation.mutateAsync).toHaveBeenCalledWith({ leadIds: ['lead-existing'] }),
    );
    expect(importMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('reports unresolved results and does not claim completion when import returns no client IDs', async () => {
    importMutation.mutateAsync.mockResolvedValue({
      imported: 0,
      skipped: 0,
      invalid: 1,
      conflicts: 0,
      items: [],
    });
    const user = userEvent.setup();
    renderWithProviders(
      <SearchResultsListAction searchId="search-1" results={[result('result-1')]} />,
    );

    await user.click(screen.getByRole('button', { name: 'Adicionar a uma Lista' }));
    await user.selectOptions(screen.getByLabelText('Lista'), 'list-1');
    await user.click(screen.getByRole('button', { name: 'Adicionar selecionados' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'não foram importados para clientes',
    );
    expect(addMutation.mutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByText('Clientes adicionados à Lista.')).not.toBeInTheDocument();
  });

  it('retains partial import IDs and retries only unresolved results', async () => {
    importMutation.mutateAsync
      .mockResolvedValueOnce({
        imported: 1,
        skipped: 0,
        invalid: 1,
        conflicts: 0,
        items: [{ resultId: 'result-1', status: 'IMPORTED', leadId: 'lead-1' }],
      })
      .mockResolvedValueOnce({
        imported: 1,
        skipped: 0,
        invalid: 0,
        conflicts: 0,
        items: [{ resultId: 'result-2', status: 'IMPORTED', leadId: 'lead-2' }],
      });
    addMutation.mutateAsync.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithProviders(
      <SearchResultsListAction
        searchId="search-1"
        results={[result('result-1'), result('result-2')]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Adicionar a uma Lista' }));
    await user.selectOptions(screen.getByLabelText('Lista'), 'list-1');
    await user.click(screen.getByRole('button', { name: 'Adicionar selecionados' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(addMutation.mutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Adicionar selecionados' }));
    await waitFor(() =>
      expect(addMutation.mutateAsync).toHaveBeenCalledWith({ leadIds: ['lead-1', 'lead-2'] }),
    );
    expect(importMutation.mutateAsync).toHaveBeenNthCalledWith(1, {
      searchId: 'search-1',
      resultIds: ['result-1', 'result-2'],
    });
    expect(importMutation.mutateAsync).toHaveBeenNthCalledWith(2, {
      searchId: 'search-1',
      resultIds: ['result-2'],
    });
  });
});
