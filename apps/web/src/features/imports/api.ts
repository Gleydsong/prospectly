import { api } from '@/lib/api';
import type {
  CsvImport,
  CsvImportError,
  CsvImportMapping,
  CsvPreview,
  PaginatedResult,
} from '@/types';

export interface ImportsQuery {
  page?: number;
  pageSize?: number;
}

function createMultipartForm(file: File, mapping?: CsvImportMapping): FormData {
  const formData = new FormData();
  formData.append('file', file);
  if (mapping) formData.append('mapping', JSON.stringify(mapping));
  return formData;
}

const multipartRequestConfig = {
  // Let the browser supply the multipart boundary instead of inheriting the JSON default.
  headers: { 'Content-Type': false },
};

export async function previewCsv(file: File): Promise<CsvPreview> {
  const { data } = await api.post<CsvPreview>(
    '/imports/csv/preview',
    createMultipartForm(file),
    multipartRequestConfig,
  );
  return data;
}

export async function createCsvImport(file: File, mapping: CsvImportMapping): Promise<CsvImport> {
  const { data } = await api.post<CsvImport>(
    '/imports/csv',
    createMultipartForm(file, mapping),
    multipartRequestConfig,
  );
  return data;
}

export async function fetchImports(query: ImportsQuery = {}): Promise<PaginatedResult<CsvImport>> {
  const { data } = await api.get<PaginatedResult<CsvImport>>('/imports', { params: query });
  return data;
}

export async function fetchCsvImport(id: string): Promise<CsvImport> {
  const { data } = await api.get<CsvImport>(`/imports/${id}`);
  return data;
}

export async function fetchCsvImportErrors(
  id: string,
  query: ImportsQuery = {},
): Promise<PaginatedResult<CsvImportError>> {
  const { data } = await api.get<PaginatedResult<CsvImportError>>(`/imports/${id}/errors`, {
    params: query,
  });
  return data;
}
