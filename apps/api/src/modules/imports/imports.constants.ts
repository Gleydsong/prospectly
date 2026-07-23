import type { CsvImportField } from './csv-parser.service';

export const IMPORTS_QUEUE = 'imports';
export const PROCESS_CSV_IMPORT_JOB = 'process-csv-import';

export const IMPORT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1_000 },
  removeOnComplete: 100,
  removeOnFail: 500,
} as const;

export interface ProcessCsvImportJobData {
  importId: string;
  correlationId?: string;
}

export const IMPORT_MAPPING_FIELDS: readonly CsvImportField[] = [
  'companyName',
  'phone',
  'email',
  'website',
  'category',
  'address',
  'city',
  'state',
  'postalCode',
  'notes',
  'tags',
];

export const CSV_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const CSV_MAX_ROWS = 10_000;
