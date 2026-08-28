import { FileSpreadsheet, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { useCreateCsvImport, useImport, useImportErrors, useImports, usePreviewCsv } from '@/features/imports/hooks';
import { getApiErrorMessage } from '@/lib/api';
import { CSV_IMPORT_FIELDS, type CsvImportField, type CsvImportMapping, type CsvPreview } from '@/types';

const FIELD_LABELS: Record<CsvImportField, string> = {
  companyName: 'Nome da empresa',
  phone: 'Telefone',
  email: 'E-mail',
  website: 'Site',
  category: 'Categoria',
  address: 'Endereço',
  city: 'Cidade',
  state: 'UF',
  postalCode: 'CEP',
  notes: 'Observações',
  tags: 'Etiquetas',
};

const IMPORT_STATUS_LABEL = {
  PENDING: 'Na fila',
  PROCESSING: 'A processar',
  COMPLETED: 'Concluída',
  FAILED: 'Falhou',
} as const;

function importStatusTone(status: keyof typeof IMPORT_STATUS_LABEL): 'amber' | 'blue' | 'green' | 'red' {
  if (status === 'PENDING') return 'amber';
  if (status === 'PROCESSING') return 'blue';
  return status === 'COMPLETED' ? 'green' : 'red';
}

function QueryErrorState({ title, error, onRetry }: { title: string; error: unknown; onRetry: () => void }) {
  return (
    <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-300" role="alert">
      <p className="font-medium">{title}</p>
      <p className="mt-1">{getApiErrorMessage(error)}</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}

function importStatusDescription(status: keyof typeof IMPORT_STATUS_LABEL): string {
  if (status === 'PENDING' || status === 'PROCESSING') {
    return 'Atualizando automaticamente enquanto o processamento estiver ativo.';
  }
  return status === 'FAILED'
    ? 'A importação falhou antes de ser concluída.'
    : 'Processamento concluído.';
}

export function ImportsPage() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [mapping, setMapping] = useState<CsvImportMapping>({});
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedImportId, setSelectedImportId] = useState('');
  const [errorsPage, setErrorsPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewCsv = usePreviewCsv();
  const createCsvImport = useCreateCsvImport();
  const importsQuery = useImports({ page: historyPage, pageSize: 10 });
  const importQuery = useImport(selectedImportId);
  const errorsQuery = useImportErrors(selectedImportId, { page: errorsPage, pageSize: 20 });
  const imports = importsQuery.data?.data ?? [];
  const selectedImport = importQuery.data ?? imports.find((csvImport) => csvImport.id === selectedImportId);

  const selectFile = (selectedFile: File | undefined) => {
    setError(null);
    setPreview(null);
    setMapping({});
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setFile(null);
      setError('Selecione um arquivo CSV.');
      return;
    }
    setFile(selectedFile);
  };

  const previewFile = async () => {
    if (!file) return;
    setError(null);
    try {
      const csvPreview = await previewCsv.mutateAsync(file);
      setPreview(csvPreview);
      setMapping(csvPreview.suggestedMapping);
    } catch (previewError) {
      setError(getApiErrorMessage(previewError));
    }
  };

  const setMappedColumn = (field: CsvImportField, column: string) => {
    setMapping((current) => ({ ...current, [field]: column || undefined }));
  };

  const createImport = async () => {
    if (!file || !mapping.companyName) return;
    setError(null);
    try {
      const csvImport = await createCsvImport.mutateAsync({ file, mapping });
      setSelectedImportId(csvImport.id);
      setErrorsPage(1);
      setFile(null);
      setPreview(null);
      setMapping({});
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (createError) {
      setError(getApiErrorMessage(createError));
    }
  };

  const selectImport = (id: string) => {
    setSelectedImportId(id);
    setErrorsPage(1);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{t('leads.imports')}</h1>
        <p className="text-sm text-zinc-500">Pré-visualize o arquivo, confirme o mapeamento e acompanhe o processamento.</p>
      </div>

      <Card>
        <CardHeader title="Selecionar arquivo" description="Aceitamos apenas CSV. Nenhum lead é criado antes da confirmação." />
        <CardContent>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-700 p-8 text-center transition-colors hover:border-brand-500 hover:bg-brand-500/150/10">
            <FileSpreadsheet className="mb-3 h-8 w-8 text-brand-400" aria-hidden />
            <span className="font-medium text-zinc-50">Escolha um arquivo CSV</span>
            <span className="mt-1 text-sm text-zinc-500">Limite e número máximo de linhas são validados pelo servidor.</span>
            <input
              ref={fileInputRef}
              aria-label="Arquivo CSV"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
          </label>
          {file ? <p className="mt-3 text-sm text-zinc-200">Arquivo selecionado: <span className="font-medium">{file.name}</span></p> : null}
          {error ? <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300" role="alert">{error}</p> : null}
          <Button type="button" className="mt-4" disabled={!file} loading={previewCsv.isPending} onClick={previewFile}>
            <Upload className="h-4 w-4" aria-hidden />
            Pré-visualizar arquivo
          </Button>
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader title="Pré-visualização" description="Confira até cinco linhas e associe as colunas antes de iniciar a importação." />
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {CSV_IMPORT_FIELDS.map((field) => (
                <label key={field} className="block text-sm font-medium text-zinc-200">
                  {FIELD_LABELS[field]}
                  <select
                    value={mapping[field] ?? ''}
                    onChange={(event) => setMappedColumn(field, event.target.value)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-50 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
                  >
                    <option value="">Não importar</option>
                    {preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
                    {preview.headers.map((header) => <th key={header} scope="col" className="px-3 py-3 font-medium">{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((row, index) => (
                    <tr key={index} className="border-b border-zinc-800">
                      {preview.headers.map((header) => <td key={header} className="px-3 py-3 text-zinc-200">{row[header] || '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-zinc-950 p-4">
              <p className="text-sm text-zinc-300">A importação será criada em fila e os leads válidos poderão ser processados parcialmente.</p>
              <Button
                type="button"
                disabled={!mapping.companyName}
                loading={createCsvImport.isPending}
                onClick={createImport}
              >
                Iniciar importação
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Histórico de importações" description="Selecione uma importação para acompanhar o processamento e as linhas rejeitadas." />
        <CardContent>
          {importsQuery.isLoading ? <p className="text-sm text-zinc-500">Carregando importações…</p> : importsQuery.isError ? (
            <QueryErrorState
              title="Não foi possível carregar o histórico de importações."
              error={importsQuery.error}
              onRetry={() => { void importsQuery.refetch(); }}
            />
          ) : imports.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhuma importação CSV criada.</p>
          ) : (
            <div className="space-y-3">
              <ul className="divide-y divide-zinc-800" aria-label="Histórico de importações CSV">
                {imports.map((csvImport) => (
                  <li key={csvImport.id}>
                    <button
                      type="button"
                      aria-pressed={csvImport.id === selectedImportId}
                      onClick={() => selectImport(csvImport.id)}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-zinc-950 focus-visible:rounded-lg"
                    >
                      <span>
                        <span className="block font-medium text-zinc-50">{csvImport.fileName}</span>
                        <span className="text-sm text-zinc-500">{csvImport.totalRows} linha(s)</span>
                      </span>
                      <Badge tone={importStatusTone(csvImport.status)}>{IMPORT_STATUS_LABEL[csvImport.status]}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
              {importsQuery.data?.meta ? <Pagination {...importsQuery.data.meta} onPageChange={setHistoryPage} /> : null}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedImport ? (
        <Card>
          <CardHeader
            title={`Importação: ${selectedImport.fileName}`}
            description={importStatusDescription(selectedImport.status)}
            action={<Badge tone={importStatusTone(selectedImport.status)}>{IMPORT_STATUS_LABEL[selectedImport.status]}</Badge>}
          />
          <CardContent className="space-y-5">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-zinc-950 p-3"><dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total</dt><dd className="mt-1 font-semibold text-zinc-50">{selectedImport.totalRows} linha(s)</dd></div>
              <div className="rounded-lg bg-brand-500/15 p-3"><dt className="text-xs font-medium uppercase tracking-wide text-brand-300">Importados</dt><dd className="mt-1 font-semibold text-brand-100">{selectedImport.importedCount} importado(s)</dd></div>
              <div className="rounded-lg bg-amber-500/10 p-3"><dt className="text-xs font-medium uppercase tracking-wide text-amber-300">Ignorados</dt><dd className="mt-1 font-semibold text-amber-200">{selectedImport.skippedCount} ignorado(s)</dd></div>
              <div className="rounded-lg bg-red-500/10 p-3"><dt className="text-xs font-medium uppercase tracking-wide text-red-300">Inválidos</dt><dd className="mt-1 font-semibold text-red-200">{selectedImport.invalidCount} inválido(s)</dd></div>
            </dl>

            {selectedImport.invalidCount > 0 ? (
              <section aria-labelledby="import-errors-heading">
                <h2 id="import-errors-heading" className="text-base font-semibold text-zinc-50">Erros por linha</h2>
                {errorsQuery.isLoading ? <p className="mt-2 text-sm text-zinc-500">Carregando erros…</p> : errorsQuery.isError ? (
                  <div className="mt-2">
                    <QueryErrorState
                      title="Não foi possível carregar os erros por linha."
                      error={errorsQuery.error}
                      onRetry={() => { void errorsQuery.refetch(); }}
                    />
                  </div>
                ) : (
                  <div className="mt-2 space-y-3">
                    <ul className="divide-y divide-red-500/20 rounded-lg border border-red-500/30">
                      {(errorsQuery.data?.data ?? []).map((rowError) => (
                        <li key={rowError.id} className="flex gap-3 p-3 text-sm">
                          <span className="font-medium text-red-300">Linha {rowError.row}</span>
                          <span className="text-red-300">{rowError.message}</span>
                        </li>
                      ))}
                    </ul>
                    {errorsQuery.data?.meta ? <Pagination {...errorsQuery.data.meta} onPageChange={setErrorsPage} /> : null}
                  </div>
                )}
              </section>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
