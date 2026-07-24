import { zodResolver } from '@hookform/resolvers/zod';
import { CheckSquare, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import {
  useCreateSearch,
  useDeleteSearch,
  useImportSearchResults,
  useSearch,
  useSearches,
  useSearchProviders,
  useSearchResults,
} from '@/features/prospecting/hooks';
import { getApiErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import {
  BRAZILIAN_STATE_CODES,
  PROSPECTING_CATEGORIES,
  PROSPECTING_CATEGORY_VALUES,
  PROSPECTING_COUNTRIES,
  PROSPECTING_COUNTRY_CODES,
  type SearchImportSummary,
  type SearchStatus,
  type WebsitePresence,
} from '@/types';

const searchSchema = z
  .object({
    category: z.enum(PROSPECTING_CATEGORY_VALUES, {
      errorMap: () => ({ message: 'Categoria obrigatória' }),
    }),
    country: z.enum(PROSPECTING_COUNTRY_CODES, {
      errorMap: () => ({ message: 'Selecione um país' }),
    }),
    city: z.string().trim().min(1, 'Cidade obrigatória').max(120),
    state: z.string().max(120).default(''),
    provider: z.enum(['OPENSTREETMAP', 'GOOGLE_PLACES']).default('OPENSTREETMAP'),
    onlyWithoutWebsite: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const region = values.state.trim();
    if (!region) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['state'],
        message: values.country === 'BR' ? 'Selecione uma UF' : 'Região obrigatória',
      });
      return;
    }
    if (values.country === 'BR' && !(BRAZILIAN_STATE_CODES as readonly string[]).includes(region)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['state'],
        message: 'Selecione uma UF',
      });
    }
  });

type SearchForm = z.infer<typeof searchSchema>;

const STATUS_LABEL: Record<SearchStatus, string> = {
  PENDING: 'Na fila',
  PROCESSING: 'A pesquisar',
  COMPLETED: 'Concluída',
  FAILED: 'Falhou',
};

const WEBSITE_LABEL: Record<WebsitePresence, string> = {
  NO_WEBSITE_REPORTED: 'Sem site informado',
  WEBSITE_FOUND: 'Site informado',
  NEEDS_REVIEW: 'Rever website',
};

function statusTone(status: SearchStatus): 'amber' | 'blue' | 'green' | 'red' {
  if (status === 'PENDING') return 'amber';
  if (status === 'PROCESSING') return 'blue';
  return status === 'COMPLETED' ? 'green' : 'red';
}

function websiteTone(status: WebsitePresence): 'amber' | 'green' | 'slate' {
  if (status === 'NO_WEBSITE_REPORTED') return 'amber';
  return status === 'WEBSITE_FOUND' ? 'green' : 'slate';
}

function ImportSummary({ summary }: { summary: SearchImportSummary }) {
  return (
    <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
      Importação concluída: {summary.imported} importado(s), {summary.skipped} ignorado(s), {summary.invalid}{' '}
      inválido(s) e {summary.conflicts} possível(is) duplicado(s).
    </p>
  );
}

function QueryErrorState({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800" role="alert">
      <p className="font-medium">{title}</p>
      <p className="mt-1">{getApiErrorMessage(error)}</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}

export function SearchPage() {
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedSearchId, setSelectedSearchId] = useState('');
  const [resultsPage, setResultsPage] = useState(1);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<SearchImportSummary | null>(null);
  const searchesQuery = useSearches({ page: historyPage, pageSize: 10 });
  const providersQuery = useSearchProviders();
  const searchQuery = useSearch(selectedSearchId);
  const { refetch: refetchResults, ...resultsQuery } = useSearchResults(selectedSearchId, {
    page: resultsPage,
    pageSize: 20,
  });
  const createSearch = useCreateSearch();
  const deleteSearch = useDeleteSearch();
  const importResults = useImportSearchResults();
  const availableProviders = providersQuery.data ?? [{ id: 'OPENSTREETMAP' as const, label: 'OpenStreetMap', available: true }];
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      category: undefined,
      country: 'BR',
      city: '',
      state: '',
      provider: 'OPENSTREETMAP',
      onlyWithoutWebsite: true,
    },
  });

  const selectedCountry = watch('country');

  useEffect(() => {
    setValue('state', '');
  }, [selectedCountry, setValue]);

  const searches = searchesQuery.data?.data ?? [];
  const resultPage = resultsQuery.data;
  const results = resultPage?.data ?? [];
  const currentSearch = searchQuery.data ?? searches.find((search) => search.id === selectedSearchId);
  const canImport = currentSearch?.status === 'COMPLETED';
  const selectableResultIds = canImport
    ? results.filter((result) => !result.importedLeadId).map((result) => result.id)
    : [];
  const allCurrentResultsSelected = selectableResultIds.length > 0 &&
    selectableResultIds.every((id) => selectedResultIds.includes(id));

  useEffect(() => {
    if (currentSearch?.status === 'COMPLETED') {
      void refetchResults();
    }
  }, [currentSearch?.status, refetchResults]);

  const selectSearch = (id: string) => {
    setSelectedSearchId(id);
    setResultsPage(1);
    setSelectedResultIds([]);
    setImportSummary(null);
  };

  const onSubmit = async (values: SearchForm) => {
    setServerError(null);
    setImportSummary(null);
    try {
      const search = await createSearch.mutateAsync(values);
      selectSearch(search.id);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    }
  };

  const toggleResult = (id: string) => {
    setSelectedResultIds((current) => current.includes(id) ? current.filter((resultId) => resultId !== id) : [...current, id]);
  };

  const toggleCurrentPage = () => {
    setSelectedResultIds(allCurrentResultsSelected ? [] : selectableResultIds);
  };

  const changeResultsPage = (page: number) => {
    setResultsPage(page);
    setSelectedResultIds([]);
  };

  const submitImport = async () => {
    if (!selectedSearchId || selectedResultIds.length === 0) return;
    setServerError(null);
    try {
      const summary = await importResults.mutateAsync({ searchId: selectedSearchId, resultIds: selectedResultIds });
      setImportSummary(summary);
      setSelectedResultIds([]);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    }
  };

  const removeSearch = async (searchId: string) => {
    const confirmed = window.confirm(
      'Apagar esta pesquisa do histórico? Os resultados serão removidos. Leads já importados permanecem.',
    );
    if (!confirmed) return;
    setServerError(null);
    try {
      await deleteSearch.mutateAsync(searchId);
      if (selectedSearchId === searchId) {
        setSelectedSearchId('');
        setSelectedResultIds([]);
        setImportSummary(null);
      }
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pesquisa de empresas</h1>
        <p className="text-sm text-slate-500">
          Encontre negócios no Brasil e na Europa via OpenStreetMap ou Google Places.
        </p>
      </div>

      <Card>
        <CardHeader title="Nova pesquisa" description="Os resultados são processados em segundo plano." />
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Select label="Fonte" error={errors.provider?.message} {...register('provider')}>
                {availableProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>{provider.label}</option>
                ))}
              </Select>
              <Select label="País" error={errors.country?.message} {...register('country')}>
                {PROSPECTING_COUNTRIES.map((country) => (
                  <option key={country.value} value={country.value}>{country.label}</option>
                ))}
              </Select>
              <Select label="Categoria" error={errors.category?.message} {...register('category')}>
                <option value="">Selecione</option>
                {PROSPECTING_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>{category.label}</option>
                ))}
              </Select>
              <Input label="Cidade" placeholder={selectedCountry === 'BR' ? 'São Paulo' : 'Lisboa'} error={errors.city?.message} {...register('city')} />
              {selectedCountry === 'BR' ? (
                <Select label="UF" error={errors.state?.message} {...register('state')}>
                  <option value="">Selecione</option>
                  {BRAZILIAN_STATE_CODES.map((state) => <option key={state} value={state}>{state}</option>)}
                </Select>
              ) : (
                <Input
                  label="Região / Distrito / Província"
                  placeholder="Lisboa"
                  error={errors.state?.message}
                  {...register('state')}
                />
              )}
            </div>
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                {...register('onlyWithoutWebsite')}
              />
              Somente empresas sem site informado
            </label>
            {serverError ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{serverError}</p> : null}
            <Button type="submit" loading={createSearch.isPending}>
              <Search className="h-4 w-4" aria-hidden />
              Pesquisar empresas
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Histórico de pesquisas" description="Selecione uma pesquisa para acompanhar resultados." />
        <CardContent>
          {searchesQuery.isLoading ? <TableSkeleton rows={3} columns={4} /> : searchesQuery.isError ? (
            <QueryErrorState
              title="Não foi possível carregar o histórico de pesquisas."
              error={searchesQuery.error}
              onRetry={() => { void searchesQuery.refetch(); }}
            />
          ) : searches.length === 0 ? (
            <EmptyState title="Nenhuma pesquisa" description="Crie uma pesquisa para começar a encontrar empresas." />
          ) : (
            <div className="space-y-3">
              <ul className="divide-y divide-slate-100" aria-label="Histórico de pesquisas">
                {searches.map((search) => (
                  <li key={search.id}>
                    <div className="flex items-start gap-2 py-3">
                      <button
                        type="button"
                        onClick={() => selectSearch(search.id)}
                        aria-pressed={search.id === selectedSearchId}
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left hover:bg-slate-50 focus-visible:rounded-lg"
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-slate-900">
                            {search.input.category} em {search.input.city}/{search.input.state}
                            {search.input.country ? ` (${search.input.country})` : ''}
                          </span>
                          <span className="text-sm text-slate-500">{search.provider} · {formatDateTime(search.createdAt)}</span>
                        </span>
                        <Badge tone={statusTone(search.status)}>{STATUS_LABEL[search.status]}</Badge>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                        aria-label={`Apagar pesquisa ${search.input.category} em ${search.input.city}`}
                        loading={deleteSearch.isPending && deleteSearch.variables === search.id}
                        onClick={() => { void removeSearch(search.id); }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                    {search.status === 'FAILED' && search.error ? <p className="pb-3 text-sm text-red-700">{search.error}</p> : null}
                  </li>
                ))}
              </ul>
              {searchesQuery.data?.meta ? <Pagination {...searchesQuery.data.meta} onPageChange={setHistoryPage} /> : null}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedSearchId ? (
        <Card>
          <CardHeader
            title="Resultados da pesquisa"
            description={currentSearch ? `${STATUS_LABEL[currentSearch.status]}${currentSearch.status === 'COMPLETED' ? ' — selecione os resultados para importar.' : ' — atualizando automaticamente enquanto estiver ativa.'}` : 'A carregar pesquisa.'}
            action={
              <Button size="sm" disabled={!canImport || selectedResultIds.length === 0} loading={importResults.isPending} onClick={submitImport}>
                <CheckSquare className="h-4 w-4" aria-hidden />
                Importar selecionados ({selectedResultIds.length})
              </Button>
            }
          />
          <CardContent>
            {importSummary ? <div className="mb-4"><ImportSummary summary={importSummary} /></div> : null}
            {resultsQuery.isLoading ? <TableSkeleton rows={5} columns={6} /> : resultsQuery.isError ? (
              <QueryErrorState
                title="Não foi possível carregar os resultados."
                error={resultsQuery.error}
                onRetry={() => { void refetchResults(); }}
              />
            ) : results.length === 0 ? (
              <EmptyState
                title={currentSearch?.status === 'COMPLETED' ? 'Nenhum resultado encontrado' : 'A pesquisa ainda não tem resultados'}
                description={currentSearch?.status === 'FAILED' ? currentSearch.error ?? 'A pesquisa não pôde ser concluída.' : 'Os resultados aparecerão aqui quando o processamento terminar.'}
              />
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                        <th scope="col" className="w-12 px-3 py-3">
                          <input
                            type="checkbox"
                            aria-label="Selecionar todos os resultados desta página"
                            checked={allCurrentResultsSelected}
                            onChange={toggleCurrentPage}
                            disabled={selectableResultIds.length === 0}
                            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          />
                        </th>
                        <th scope="col" className="px-3 py-3 font-medium">Empresa</th>
                        <th scope="col" className="px-3 py-3 font-medium">Telefone</th>
                        <th scope="col" className="px-3 py-3 font-medium">Endereço</th>
                        <th scope="col" className="px-3 py-3 font-medium">Categoria</th>
                        <th scope="col" className="px-3 py-3 font-medium">Website</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result) => {
                        const business = result.normalizedData ?? result.data;
                        const imported = Boolean(result.importedLeadId);
                        return (
                          <tr key={result.id} className="border-b border-slate-50">
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                aria-label={`Selecionar ${business.companyName}`}
                                checked={selectedResultIds.includes(result.id)}
                                onChange={() => toggleResult(result.id)}
                                disabled={imported || !canImport}
                                title={imported ? 'Resultado já importado' : !canImport ? 'Aguarde a conclusão da pesquisa' : undefined}
                                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                              />
                            </td>
                            <td className="px-3 py-3 font-medium text-slate-900">{business.companyName}{imported ? <span className="ml-2 text-xs font-normal text-slate-500">Importado</span> : null}</td>
                            <td className="px-3 py-3 text-slate-600">{business.phone ?? '—'}</td>
                            <td className="px-3 py-3 text-slate-600">{business.address ?? `${business.city}/${business.state}`}</td>
                            <td className="px-3 py-3 text-slate-600">{business.category ?? '—'}</td>
                            <td className="px-3 py-3"><Badge tone={websiteTone(result.websitePresence)}>{WEBSITE_LABEL[result.websitePresence]}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {resultPage?.meta ? <Pagination {...resultPage.meta} onPageChange={changeResultsPage} /> : null}
                <p className="text-xs text-slate-500">
                  Dados ©{' '}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-slate-700"
                  >
                    colaboradores do OpenStreetMap
                  </a>
                  , sob a ODbL.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
