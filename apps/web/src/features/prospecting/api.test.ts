import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { fetchAllSearchResultIds } from './api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
const get = vi.mocked(api.get);

beforeEach(() => vi.clearAllMocks());

describe('add all stored search results', () => {
  it('reads every page and deduplicates unsaved results without another provider search', async () => {
    get
      .mockResolvedValueOnce({
        data: {
          data: [{ id: 'a' }, { id: 'saved', importedLeadId: 'client' }],
          meta: { totalPages: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: { data: [{ id: 'b' }, { id: 'a' }], meta: { totalPages: 2 } },
      });
    await expect(fetchAllSearchResultIds('search')).resolves.toEqual(['a', 'b']);
    expect(get).toHaveBeenNthCalledWith(1, '/searches/search/results', {
      params: { page: 1, pageSize: 100 },
    });
    expect(get).toHaveBeenNthCalledWith(2, '/searches/search/results', {
      params: { page: 2, pageSize: 100 },
    });
  });

  it('fails without returning a partial selection when a later page fails', async () => {
    get
      .mockResolvedValueOnce({ data: { data: [{ id: 'a' }], meta: { totalPages: 2 } } })
      .mockRejectedValueOnce(new Error('offline'));
    await expect(fetchAllSearchResultIds('search')).rejects.toThrow('offline');
  });
});
