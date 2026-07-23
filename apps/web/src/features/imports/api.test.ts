import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/lib/api';
import { createCsvImport, previewCsv } from './api';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

const postMock = vi.mocked(api.post);

describe('CSV imports API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends a selected CSV file as multipart data for preview', async () => {
    const file = new File(['Empresa,Email\nAcme,contato@acme.test'], 'leads.csv', { type: 'text/csv' });
    postMock.mockResolvedValue({ data: { headers: ['Empresa', 'Email'], rows: [], suggestedMapping: {} } });

    await previewCsv(file);

    const [, formData] = postMock.mock.calls[0] ?? [];
    expect(postMock).toHaveBeenCalledWith(
      '/imports/csv/preview',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': false } }),
    );
    expect(formData).toBeInstanceOf(FormData);
    expect((formData as FormData).get('file')).toBe(file);
  });

  it('serializes the confirmed mapping alongside the CSV file', async () => {
    const file = new File(['Empresa\nAcme'], 'leads.csv', { type: 'text/csv' });
    postMock.mockResolvedValue({ data: { id: 'import-1' } });

    await createCsvImport(file, { companyName: 'Empresa', email: 'E-mail' });

    const [, formData] = postMock.mock.calls[0] ?? [];
    expect(postMock).toHaveBeenCalledWith(
      '/imports/csv',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': false } }),
    );
    expect((formData as FormData).get('mapping')).toBe('{"companyName":"Empresa","email":"E-mail"}');
  });
});
