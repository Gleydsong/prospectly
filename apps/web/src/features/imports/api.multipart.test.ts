import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';

import { api } from '@/lib/api';
import { createCsvImport, previewCsv } from './api';

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

describe('CSV multipart transport', () => {
  it.each([
    ['preview', (file: File) => previewCsv(file)],
    ['creation', (file: File) => createCsvImport(file, { companyName: 'Empresa' })],
  ])('keeps FormData and clears the global JSON content type for %s', async (_operation, request) => {
    let intercepted: InternalAxiosRequestConfig | undefined;
    api.defaults.adapter = (async (config) => {
      intercepted = config;
      return {
        data: { id: 'import-1', headers: [], rows: [], suggestedMapping: {} },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    }) satisfies AxiosAdapter;

    await request(new File(['Empresa\nAcme'], 'leads.csv', { type: 'text/csv' }));

    expect(intercepted?.data).toBeInstanceOf(FormData);
    expect(intercepted?.headers.getContentType()).toBe(false);
  });
});
