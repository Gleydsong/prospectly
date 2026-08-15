import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchCsvImport } from './api';
import { useImport } from './hooks';

vi.mock('./api', () => ({
  fetchCsvImport: vi.fn(),
}));

const fetchCsvImportMock = vi.mocked(fetchCsvImport);

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useImport', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('polls active imports every two seconds and stops after completion', async () => {
    vi.useFakeTimers();
    fetchCsvImportMock
      .mockResolvedValueOnce({
        id: 'import-1',
        fileName: 'leads.csv',
        status: 'PROCESSING',
        totalRows: 3,
        importedCount: 1,
        skippedCount: 0,
        invalidCount: 0,
        createdAt: '2026-07-22T10:00:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 'import-1',
        fileName: 'leads.csv',
        status: 'COMPLETED',
        totalRows: 3,
        importedCount: 2,
        skippedCount: 0,
        invalidCount: 1,
        createdAt: '2026-07-22T10:00:00.000Z',
      });

    renderHook(() => useImport('import-1'), { wrapper: createWrapper() });

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchCsvImportMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(fetchCsvImportMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(fetchCsvImportMock).toHaveBeenCalledTimes(2);
  });
});
