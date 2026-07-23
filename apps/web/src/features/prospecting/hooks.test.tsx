import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchSearch, fetchSearchResults } from './api';
import { useSearch, useSearchResults } from './hooks';

vi.mock('./api', () => ({
  fetchSearch: vi.fn(),
  fetchSearchResults: vi.fn(),
}));

const fetchSearchMock = vi.mocked(fetchSearch);
const fetchSearchResultsMock = vi.mocked(fetchSearchResults);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSearch', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('polls pending searches every two seconds and stops after a terminal status', async () => {
    vi.useFakeTimers();
    fetchSearchMock
      .mockResolvedValueOnce({
        id: 'search-1',
        status: 'PENDING',
        provider: 'OPENSTREETMAP',
        input: { category: 'restaurant', city: 'Lisboa', state: 'SP', onlyWithoutWebsite: true },
        error: null,
        createdAt: '2026-07-22T10:00:00.000Z',
        completedAt: null,
      })
      .mockResolvedValueOnce({
        id: 'search-1',
        status: 'COMPLETED',
        provider: 'OPENSTREETMAP',
        input: { category: 'restaurant', city: 'Lisboa', state: 'SP', onlyWithoutWebsite: true },
        error: null,
        createdAt: '2026-07-22T10:00:00.000Z',
        completedAt: '2026-07-22T10:00:02.000Z',
      });

    renderHook(() => useSearch('search-1'), { wrapper: createWrapper() });

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchSearchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(fetchSearchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });

    expect(fetchSearchMock).toHaveBeenCalledTimes(2);
  });

  it('does not keep selectable results from the previous page while the next page loads', async () => {
    let resolveSecondPage: ((value: {
      data: Array<{ id: string }>;
      meta: { page: number; pageSize: number; total: number; totalPages: number };
    }) => void) | undefined;
    fetchSearchResultsMock
      .mockResolvedValueOnce({
        data: [{ id: 'result-page-one' }],
        meta: { page: 1, pageSize: 20, total: 21, totalPages: 2 },
      } as never)
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSecondPage = resolve as typeof resolveSecondPage;
      }));

    const { result, rerender } = renderHook(
      ({ page }) => useSearchResults('search-1', { page, pageSize: 20 }),
      { initialProps: { page: 1 }, wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.data?.data[0]?.id).toBe('result-page-one'));
    rerender({ page: 2 });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(true);

    resolveSecondPage?.({
      data: [{ id: 'result-page-two' }],
      meta: { page: 2, pageSize: 20, total: 21, totalPages: 2 },
    });
    await waitFor(() => expect(result.current.data?.data[0]?.id).toBe('result-page-two'));
  });
});
