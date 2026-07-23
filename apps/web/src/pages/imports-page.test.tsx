import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImportsPage } from './imports-page';

const mocks = vi.hoisted(() => ({
  previewCsv: vi.fn(),
  createImport: vi.fn(),
  useImports: vi.fn(),
  useImport: vi.fn(),
  useImportErrors: vi.fn(),
}));

vi.mock('@/features/imports/hooks', () => ({
  usePreviewCsv: () => ({ mutateAsync: mocks.previewCsv, isPending: false }),
  useCreateCsvImport: () => ({ mutateAsync: mocks.createImport, isPending: false }),
  useImports: (...args: unknown[]) => mocks.useImports(...args),
  useImport: (...args: unknown[]) => mocks.useImport(...args),
  useImportErrors: (...args: unknown[]) => mocks.useImportErrors(...args),
}));

describe('ImportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useImports.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.useImport.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
    mocks.useImportErrors.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });
  });

  it('rejects a non-CSV file before requesting a preview', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ImportsPage />);

    await user.upload(
      screen.getByLabelText('Arquivo CSV'),
      new File(['Empresa\nAcme'], 'leads.txt', { type: 'text/plain' }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Selecione um arquivo CSV.');
    expect(mocks.previewCsv).not.toHaveBeenCalled();
  });

  it('previews the first five rows and applies the suggested mapping', async () => {
    const user = userEvent.setup();
    const file = new File(['Empresa,E-mail\nAcme,contato@acme.test'], 'leads.csv', { type: 'text/csv' });
    mocks.previewCsv.mockResolvedValue({
      headers: ['Empresa', 'E-mail'],
      rows: [{ Empresa: 'Acme', 'E-mail': 'contato@acme.test' }],
      suggestedMapping: { companyName: 'Empresa', email: 'E-mail' },
    });
    render(<ImportsPage />);

    await user.upload(screen.getByLabelText('Arquivo CSV'), file);
    await user.click(screen.getByRole('button', { name: 'Pré-visualizar arquivo' }));

    expect(await screen.findByRole('heading', { name: 'Pré-visualização' })).toBeInTheDocument();
    expect(mocks.previewCsv).toHaveBeenCalledWith(file);
    expect(screen.getByLabelText('Nome da empresa')).toHaveValue('Empresa');
    expect(screen.getByText('contato@acme.test')).toBeInTheDocument();
  });

  it('requires a company-name mapping before confirmation', async () => {
    const user = userEvent.setup();
    mocks.previewCsv.mockResolvedValue({
      headers: ['Empresa'],
      rows: [{ Empresa: 'Acme' }],
      suggestedMapping: {},
    });
    render(<ImportsPage />);

    await user.upload(screen.getByLabelText('Arquivo CSV'), new File(['Empresa\nAcme'], 'leads.csv'));
    await user.click(screen.getByRole('button', { name: 'Pré-visualizar arquivo' }));

    expect(await screen.findByRole('button', { name: 'Iniciar importação' })).toBeDisabled();
    expect(mocks.createImport).not.toHaveBeenCalled();
  });

  it('creates the confirmed import and resets the file input only after success', async () => {
    const user = userEvent.setup();
    const file = new File(['Empresa\nAcme'], 'leads.csv', { type: 'text/csv' });
    mocks.previewCsv.mockResolvedValue({
      headers: ['Empresa'], rows: [{ Empresa: 'Acme' }], suggestedMapping: { companyName: 'Empresa' },
    });
    mocks.createImport.mockResolvedValue({ id: 'import-created' });
    render(<ImportsPage />);

    const input = screen.getByLabelText('Arquivo CSV') as HTMLInputElement;
    await user.upload(input, file);
    await user.click(screen.getByRole('button', { name: 'Pré-visualizar arquivo' }));
    await user.click(await screen.findByRole('button', { name: 'Iniciar importação' }));

    expect(mocks.createImport).toHaveBeenCalledWith({ file, mapping: { companyName: 'Empresa' } });
    expect(input.files).toHaveLength(0);
  });

  it('shows import progress and row-level errors for a selected job', async () => {
    const user = userEvent.setup();
    const completedImport = {
      id: 'import-1', fileName: 'leads.csv', status: 'COMPLETED', totalRows: 3,
      importedCount: 2, skippedCount: 0, invalidCount: 1, createdAt: '2026-07-22T10:00:00.000Z',
    };
    mocks.useImports.mockReturnValue({
      data: { data: [completedImport], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocks.useImport.mockReturnValue({ data: completedImport, isLoading: false, isError: false, refetch: vi.fn() });
    mocks.useImportErrors.mockReturnValue({
      data: {
        data: [{ id: 'error-1', row: 4, message: 'Company name is required', createdAt: '2026-07-22T10:01:00.000Z' }],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<ImportsPage />);

    await user.click(screen.getByRole('button', { name: /leads\.csv/i }));

    expect(screen.getAllByText('Concluída')).not.toHaveLength(0);
    expect(screen.getByText('2 importado(s)')).toBeInTheDocument();
    expect(screen.getByText('Linha 4')).toBeInTheDocument();
    expect(screen.getByText('Company name is required')).toBeInTheDocument();
  });

  it('paginates the import history using the API metadata', async () => {
    const user = userEvent.setup();
    mocks.useImports.mockReturnValue({
      data: {
        data: [{ id: 'import-1', fileName: 'first.csv', status: 'COMPLETED', totalRows: 1, importedCount: 1, skippedCount: 0, invalidCount: 0, createdAt: '2026-07-22T10:00:00.000Z' }],
        meta: { page: 1, pageSize: 10, total: 11, totalPages: 2 },
      },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    render(<ImportsPage />);

    await user.click(screen.getByRole('button', { name: 'Próxima página' }));

    expect(mocks.useImports).toHaveBeenLastCalledWith({ page: 2, pageSize: 10 });
  });

  it('paginates row errors independently from the import history', async () => {
    const user = userEvent.setup();
    const csvImport = { id: 'import-1', fileName: 'leads.csv', status: 'COMPLETED', totalRows: 21, importedCount: 0, skippedCount: 0, invalidCount: 21, createdAt: '2026-07-22T10:00:00.000Z' };
    mocks.useImports.mockReturnValue({
      data: { data: [csvImport], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    mocks.useImport.mockReturnValue({ data: csvImport, isLoading: false, isError: false, refetch: vi.fn() });
    mocks.useImportErrors.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 20, total: 21, totalPages: 2 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    render(<ImportsPage />);

    await user.click(screen.getByRole('button', { name: /leads\.csv/i }));
    const nextErrorsPage = screen.getAllByRole('button', { name: 'Próxima página' })
      .find((button) => !button.hasAttribute('disabled'));
    expect(nextErrorsPage).toBeDefined();
    await user.click(nextErrorsPage!);

    expect(mocks.useImportErrors).toHaveBeenLastCalledWith('import-1', { page: 2, pageSize: 20 });
  });

  it('shows a retriable error instead of an empty import history', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mocks.useImports.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('offline'), refetch });
    render(<ImportsPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o histórico de importações.');
    expect(screen.queryByText('Nenhuma importação CSV criada.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it('shows a retriable error when row errors cannot be loaded', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    const csvImport = { id: 'import-1', fileName: 'leads.csv', status: 'COMPLETED', totalRows: 1, importedCount: 0, skippedCount: 0, invalidCount: 1, createdAt: '2026-07-22T10:00:00.000Z' };
    mocks.useImports.mockReturnValue({
      data: { data: [csvImport], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    mocks.useImport.mockReturnValue({ data: csvImport, isLoading: false, isError: false, refetch: vi.fn() });
    mocks.useImportErrors.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('offline'), refetch });
    render(<ImportsPage />);

    await user.click(screen.getByRole('button', { name: /leads\.csv/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os erros por linha.');
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it('uses failure-specific copy for failed imports', async () => {
    const user = userEvent.setup();
    const failedImport = { id: 'import-1', fileName: 'failed.csv', status: 'FAILED', totalRows: 2, importedCount: 0, skippedCount: 0, invalidCount: 0, createdAt: '2026-07-22T10:00:00.000Z' };
    mocks.useImports.mockReturnValue({
      data: { data: [failedImport], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false, isError: false, refetch: vi.fn(),
    });
    mocks.useImport.mockReturnValue({ data: failedImport, isLoading: false, isError: false, refetch: vi.fn() });
    render(<ImportsPage />);

    await user.click(screen.getByRole('button', { name: /failed\.csv/i }));

    expect(screen.getByText('A importação falhou antes de ser concluída.')).toBeInTheDocument();
  });
});
