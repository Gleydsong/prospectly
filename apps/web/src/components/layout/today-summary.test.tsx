import userEvent from '@testing-library/user-event';
import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { fetchDashboardSummary } from '@/features/dashboard/api';
import { useUpdateLead } from '@/features/leads/hooks';
import { fetchLeads, updateLead } from '@/features/leads/api';
import { TodaySummary } from './today-summary';

vi.mock('@/features/dashboard/api', () => ({ fetchDashboardSummary: vi.fn() }));
vi.mock('@/features/leads/api', () => ({ fetchLeads: vi.fn(), updateLead: vi.fn() }));

describe('TodaySummary', () => {
  beforeEach(() => vi.resetAllMocks());

  afterEach(() => vi.useRealTimers());

  it('switches to the new UTC day even when API responses stay unchanged', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-19T23:59:30Z'));
    vi.mocked(fetchDashboardSummary).mockResolvedValue({
      contacted: 0,
      qualified: 0,
      won: 0,
    } as Awaited<ReturnType<typeof fetchDashboardSummary>>);
    vi.mocked(fetchLeads).mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 1, total: 0, totalPages: 0 },
    });
    renderWithProviders(<TodaySummary />, { withGoogle: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(fetchLeads).toHaveBeenCalledWith(
      expect.objectContaining({ createdFrom: '2026-10-19', createdTo: '2026-10-19' }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchLeads).toHaveBeenCalledWith(
      expect.objectContaining({ createdFrom: '2026-10-20', createdTo: '2026-10-20' }),
    );
  });

  it('shows real creation totals and explicitly labels accumulated portfolio statuses', async () => {
    vi.mocked(fetchDashboardSummary).mockResolvedValue({
      contacted: 18,
      qualified: 32,
      won: 7,
    } as Awaited<ReturnType<typeof fetchDashboardSummary>>);
    vi.mocked(fetchLeads).mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 1, total: 4, totalPages: 4 },
    });
    renderWithProviders(<TodaySummary />, { withGoogle: false });
    expect(await screen.findByText('18')).toBeInTheDocument();
    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(screen.getByText('Contatados na carteira')).toBeInTheDocument();
    expect(screen.getByText('Qualificados na carteira')).toBeInTheDocument();
    expect(fetchDashboardSummary).toHaveBeenCalledWith({ period: 'all' });
    const query = vi.mocked(fetchLeads).mock.calls[0]![0];
    expect(query.createdFrom).toBe(new Date().toISOString().slice(0, 10));
    expect(query.createdTo).toBe(query.createdFrom);
  });

  it('shows unavailable values instead of invented zeroes when APIs fail', async () => {
    vi.mocked(fetchDashboardSummary).mockRejectedValue(new Error('offline'));
    vi.mocked(fetchLeads).mockRejectedValue(new Error('offline'));
    renderWithProviders(<TodaySummary />, { withGoogle: false });
    expect(await screen.findByRole('status')).toHaveTextContent('Resumo indisponível');
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
  it('refreshes portfolio counters after a successful client status mutation', async () => {
    vi.mocked(fetchDashboardSummary)
      .mockResolvedValueOnce({ contacted: 1, qualified: 0, won: 0 } as Awaited<
        ReturnType<typeof fetchDashboardSummary>
      >)
      .mockResolvedValue({ contacted: 2, qualified: 0, won: 0 } as Awaited<
        ReturnType<typeof fetchDashboardSummary>
      >);
    vi.mocked(fetchLeads).mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 1, total: 0, totalPages: 0 },
    });
    vi.mocked(updateLead).mockResolvedValue({} as Awaited<ReturnType<typeof updateLead>>);
    function StatusAction() {
      const mutation = useUpdateLead('client-1');
      return (
        <>
          <TodaySummary />
          <button onClick={() => mutation.mutate({ companyName: 'Updated' })}>Update client</button>
        </>
      );
    }
    renderWithProviders(<StatusAction />, { withGoogle: false });
    expect(await screen.findByText('1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Update client' }));
    expect(await screen.findByText('2')).toBeInTheDocument();
  });
});
