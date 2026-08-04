import { zodResolver } from '@hookform/resolvers/zod';
import { Download, Lock, Search, Send, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useBillingStatus } from '@/features/billing/hooks';
import { downloadCsvFile } from '@/features/leads/api';
import {
  useCreateSearch,
  useDeleteSearch,
  useGeoCities,
  useGeoRegions,
  useImportSearchResults,
  useProspectingCategories,
  useSearch,
  useSearches,
  useSearchProviders,
  useSearchResults,
} from '@/features/prospecting/hooks';
import { planLabel, SearchQuotaBanner } from '@/features/prospecting/components/search-quota-banner';
import { SearchResultCard } from '@/features/prospecting/components/search-result-card';
import { getApiErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import {
  DEFAULT_SEARCH_RESULT_LIMIT,
  PROSPECTING_CATEGORIES,
  PROSPECTING_CATEGORY_VALUES,
  PROSPECTING_COUNTRIES,
  PROSPECTING_COUNTRY_CODES,
  SEARCH_RESULT_LIMITS,
  type ProspectingCategory,
  type ProspectingCategoryOption,
  type ProspectingSearchResult,
  type SearchImportSummary,
  type SearchResultLimit,
  type SearchStatus,
} from '@/types';

const searchSchema = z
  .object({
    categories: z
      .array(z.enum(PROSPECTING_CATEGORY_VALUES))
      .min(1, 'Selecione pelo menos um nicho')
      .max(10, 'Selecione no máximo 10 nichos'),
    country: z.enum(PROSPECTING_COUNTRY_CODES, {
      errorMap: () => ({ message: 'Selecione um país' }),
    }),
    city: z.string().max(120).default(''),
    neighborhood: z.string().max(120).default(''),
    state: z.string().max(120).default(''),
    provider: z.enum(['OPENSTREETMAP', 'GOOGLE_PLACES']).default('OPENSTREETMAP'),
    limit: z.number(),
    onlyWithoutWebsite: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (!values.state.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['state'],
        message: 'Selecione uma região',
      });
    }
    if (!values.city.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['city'],
        message: 'Selecione uma cidade',
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

const CATEGORY_LABEL = Object.fromEntries(
  PROSPECTING_CATEGORIES.map((category) => [category.value, category.label]),
) as Record<string, string>;

const CSV_COLUMNS = [
  'empresa',
  'categoria',
  'telefone',
  'email',
  'website',
  'endereco',
  'cidade',
  'estado',
  'possui_site',
] as const;

function formatSearchHeading(input: {
  categories?: string[];
  category?: string;
  city: string;
}): string {
  const values =
    input.categories && input.categories.length > 0
      ? input.categories
      : input.category
        ? [input.category]
        : [];
  const labels = values.map((value) => CATEGORY_LABEL[value] ?? value);
  const categoryText = labels.length > 0 ? labels.join(', ') : 'Pesquisa';
  return `${categoryText} / ${input.city}`;
}

function statusTone(status: SearchStatus): 'amber' | 'blue' | 'green' | 'red' {
  if (status === 'PENDING') return 'amber';
  if (status === 'PROCESSING') return 'blue';
  return status === 'COMPLETED' ? 'green' : 'red';
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildResultsCsv(results: ProspectingSearchResult[]): string {
  const rows = results.map((result) => {
    const business = result.normalizedData ?? result.data;
    return [
      business.companyName,
      business.category ?? '',
      business.phone ?? '',
      business.email ?? '',
      business.website ?? '',
      business.address ?? '',
      business.city,
      business.state,
      result.websitePresence === 'WEBSITE_FOUND' ? 'sim' : 'nao',
    ]
      .map(csvCell)
      .join(',');
  });
  return [CSV_COLUMNS.join(','), ...rows].join('\n');
}

function ImportSummaryNotice({ summary }: { summary: SearchImportSummary }) {
  return (
    <div className="space-y-2 rounded-control bg-brand-500/15 p-3 text-sm text-brand-200" role="status">
      <p>
        Importação concluída: {summary.imported} importado(s), {summary.skipped} ignorado(s),{' '}
        {summary.invalid} inválido(s) e {summary.conflicts} possível(is) duplicado(s).
      </p>
      {summary.items && summary.items.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-brand-100/90">
          {summary.items.map((item) => (
            <li key={item.resultId}>
              {item.companyName ?? item.resultId}: {item.status}
              {item.leadId ? (
                <>
                  {' '}
                  —{' '}
                  <Link className="underline hover:text-white" to={`/leads/${item.leadId}`}>
                    ver lead
                  </Link>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
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
    <div className="rounded-control bg-red-500/10 p-4 text-sm text-red-300" role="alert">
      <p className="font-medium">{title}</p>
      <p className="mt-1">{getApiErrorMessage(error)}</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}

export function SearchPage() {
  const { t } = useTranslation();
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedSearchId, setSelectedSearchId] = useState('');
  const [resultsPage, setResultsPage] = useState(1);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [importingResultId, setImportingResultId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<SearchImportSummary | null>(null);

  const searchesQuery = useSearches({ page: historyPage, pageSize: 10 });
  const providersQuery = useSearchProviders();
  const categoriesQuery = useProspectingCategories();
  const billingQuery = useBillingStatus();
  const searchQuery = useSearch(selectedSearchId);
  const { refetch: refetchResults, ...resultsQuery } = useSearchResults(selectedSearchId, {
    page: resultsPage,
    pageSize: 20,
  });
  const createSearch = useCreateSearch();
  const deleteSearch = useDeleteSearch();
  const importResults = useImportSearchResults();

  const availableProviders = providersQuery.data ?? [
    { id: 'OPENSTREETMAP' as const, label: 'OpenStreetMap', available: true },
  ];
  const categoryOptions: ProspectingCategoryOption[] =
    categoriesQuery.data?.categories ??
    PROSPECTING_CATEGORIES.map((category) => ({ ...category, available: true }));
  const plan = categoriesQuery.data?.plan ?? billingQuery.data?.plan;
  const availableCategoryCount = categoriesQuery.data?.availableCount ?? categoryOptions.length;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      categories: [],
      country: 'BR',
      city: '',
      neighborhood: '',
      state: '',
      provider: 'OPENSTREETMAP',
      limit: DEFAULT_SEARCH_RESULT_LIMIT,
      onlyWithoutWebsite: false,
    },
  });

  const selectedCountry = watch('country');
  const selectedCategories = watch('categories');
  const selectedRegion = watch('state');
  const selectedLimit = watch('limit');
  const regionsQuery = useGeoRegions(selectedCountry);
  const citiesQuery = useGeoCities(selectedCountry, selectedRegion || undefined);
  const regions = regionsQuery.data ?? [];
  const cities = citiesQuery.data ?? [];

  useEffect(() => {
    setValue('state', '');
    setValue('city', '');
  }, [selectedCountry, setValue]);

  useEffect(() => {
    setValue('city', '');
  }, [selectedRegion, setValue]);

  const addCategory = (value: string) => {
    if (!value) return;
    const category = value as ProspectingCategory;
    const current = selectedCategories ?? [];
    if (current.includes(category)) return;
    setValue('categories', [...current, category], { shouldValidate: true, shouldDirty: true });
  };

  const removeCategory = (category: ProspectingCategory) => {
    setValue(
      'categories',
      (selectedCategories ?? []).filter((entry) => entry !== category),
      { shouldValidate: true, shouldDirty: true },
    );
  };

  const searches = searchesQuery.data?.data ?? [];
  const resultPage = resultsQuery.data;
  const results = useMemo(() => resultPage?.data ?? [], [resultPage]);
  const currentSearch = searchQuery.data ?? searches.find((search) => search.id === selectedSearchId);
  const canImport = currentSearch?.status === 'COMPLETED';
  const selectableResultIds = canImport
    ? results.filter((result) => !result.importedLeadId).map((result) => result.id)
    : [];
  const allCurrentResultsSelected =
    selectableResultIds.length > 0 &&
    selectableResultIds.every((id) => selectedResultIds.includes(id));
  const withoutWebsiteCount = results.filter(
    (result) => result.websitePresence !== 'WEBSITE_FOUND',
  ).length;

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
      const region = regions.find((entry) => entry.code === values.state);
      const stateForSearch =
        values.country === 'BR' ? values.state : (region?.name ?? values.state);
      const neighborhood = values.neighborhood.trim();
      const search = await createSearch.mutateAsync({
        categories: values.categories,
        country: values.country,
        city: values.city,
        state: stateForSearch,
        provider: values.provider,
        onlyWithoutWebsite: values.onlyWithoutWebsite,
        limit: values.limit as SearchResultLimit,
        ...(neighborhood ? { neighborhood } : {}),
      });
      selectSearch(search.id);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    }
  };

  const toggleResult = (id: string) => {
    setSelectedResultIds((current) =>
      current.includes(id) ? current.filter((resultId) => resultId !== id) : [...current, id],
    );
  };

  const toggleCurrentPage = () => {
    setSelectedResultIds(allCurrentResultsSelected ? [] : selectableResultIds);
  };

  const changeResultsPage = (page: number) => {
    setResultsPage(page);
    setSelectedResultIds([]);
  };

  const runImport = async (resultIds: string[], singleResultId?: string) => {
    if (!selectedSearchId || resultIds.length === 0) return;
    setServerError(null);
    setImportingResultId(singleResultId ?? null);
    try {
      const summary = await importResults.mutateAsync({
        searchId: selectedSearchId,
        resultIds,
      });
      setImportSummary(summary);
      setSelectedResultIds((current) => current.filter((id) => !resultIds.includes(id)));
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setImportingResultId(null);
    }
  };

  const exportResultsCsv = () => {
    const exportable = selectedResultIds.length
      ? results.filter((result) => selectedResultIds.includes(result.id))
      : results;
    if (exportable.length === 0) return;
    downloadCsvFile(`prospectly-resultados-${Date.now()}.csv`, buildResultsCsv(exportable));
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{t('leads.search')}</h1>
          <p className="text-sm text-zinc-500">
            Encontre negócios locais por nicho e localização no Brasil e na Europa.
          </p>
        </div>
        <SearchQuotaBanner usage={billingQuery.data?.searchUsage} plan={plan} />
      </div>

      <Card>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
              <Select label="País" error={errors.country?.message} {...register('country')}>
                {PROSPECTING_COUNTRIES.map((country) => (
                  <option key={country.value} value={country.value}>
                    {country.label}
                  </option>
                ))}
              </Select>
              <Select
                label="Região"
                error={
                  errors.state?.message ??
                  (regionsQuery.isError ? getApiErrorMessage(regionsQuery.error) : undefined)
                }
                disabled={!selectedCountry || regionsQuery.isLoading}
                {...register('state')}
              >
                <option value="">{regionsQuery.isLoading ? 'A carregar…' : 'Selecione o estado'}</option>
                {regions.map((region) => (
                  <option key={region.code} value={region.code}>
                    {selectedCountry === 'BR' ? `${region.code} — ${region.name}` : region.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Cidade"
                error={
                  errors.city?.message ??
                  (citiesQuery.isError ? getApiErrorMessage(citiesQuery.error) : undefined)
                }
                disabled={!selectedRegion || citiesQuery.isLoading}
                {...register('city')}
              >
                <option value="">
                  {!selectedRegion
                    ? 'Escolha o estado primeiro'
                    : citiesQuery.isLoading
                      ? 'A carregar…'
                      : 'Selecione a cidade'}
                </option>
                {cities.map((city) => (
                  <option key={city.name} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </Select>
              <Input
                label="Bairro (opcional)"
                placeholder="Ex.: Casa Caiada"
                error={errors.neighborhood?.message}
                {...register('neighborhood')}
              />
              <Select
                id="niche"
                label="Nicho"
                value=""
                onChange={(event) => addCategory(event.target.value)}
              >
                <option value="">Selecione o nicho</option>
                {categoryOptions.map((category) => (
                  <option key={category.value} value={category.value} disabled={!category.available}>
                    {category.label}
                    {category.available ? '' : ' — plano pago'}
                  </option>
                ))}
              </Select>
              <div className="flex items-end">
                <Button type="submit" className="w-full" loading={createSearch.isPending}>
                  <Search className="h-4 w-4" aria-hidden />
                  Pesquisar empresas
                </Button>
              </div>
            </div>

            {selectedCategories.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label="Nichos selecionados">
                {selectedCategories.map((category) => (
                  <li key={category}>
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 py-1 pl-3 pr-1 text-xs font-medium text-brand-200">
                      {CATEGORY_LABEL[category] ?? category}
                      <button
                        type="button"
                        aria-label={`Remover ${CATEGORY_LABEL[category] ?? category}`}
                        onClick={() => removeCategory(category)}
                        className="rounded-full p-0.5 hover:bg-brand-500/20"
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {errors.categories?.message ? (
              <p className="text-sm text-red-400" role="alert">
                {errors.categories.message}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-300">Quantidade</span>
                <div className="flex gap-1" role="group" aria-label="Quantidade de resultados">
                  {SEARCH_RESULT_LIMITS.map((limit) => (
                    <button
                      key={limit}
                      type="button"
                      aria-pressed={selectedLimit === limit}
                      onClick={() => setValue('limit', limit, { shouldDirty: true })}
                      className={
                        selectedLimit === limit
                          ? 'h-8 rounded-control bg-brand-600 px-3 text-sm font-medium text-white'
                          : 'h-8 rounded-control border border-zinc-700 px-3 text-sm text-zinc-300 hover:bg-zinc-800'
                      }
                    >
                      {limit}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-44">
                <Select
                  aria-label="Fonte"
                  className="h-8"
                  error={errors.provider?.message}
                  {...register('provider')}
                >
                  {availableProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </Select>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-brand-500 focus:ring-brand-400"
                  {...register('onlyWithoutWebsite')}
                />
                Somente empresas sem site informado
              </label>
            </div>

            {serverError ? (
              <p className="rounded-control bg-red-500/10 p-3 text-sm text-red-300" role="alert">
                {serverError}
              </p>
            ) : null}
          </form>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-3 text-xs text-zinc-500">
            <p className="flex items-center gap-1.5">
              {availableCategoryCount < categoryOptions.length ? (
                <Lock className="h-3.5 w-3.5" aria-hidden />
              ) : null}
              {availableCategoryCount} de {categoryOptions.length} nichos disponíveis no plano{' '}
              {planLabel(plan)}
            </p>
            <Link to="/settings" className="text-brand-300 hover:underline">
              Ver todos os planos →
            </Link>
          </div>
        </CardContent>
      </Card>

      {selectedSearchId ? (
        <Card>
          <CardHeader
            title="Resultados da pesquisa"
            description={
              currentSearch
                ? `${STATUS_LABEL[currentSearch.status]}${
                    currentSearch.status === 'COMPLETED'
                      ? ' — selecione os resultados para enviar ao CRM.'
                      : ' — atualizando automaticamente enquanto estiver ativa.'
                  }`
                : 'A carregar pesquisa.'
            }
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={results.length === 0}
                  onClick={exportResultsCsv}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Exportar CSV
                </Button>
                <Button
                  size="sm"
                  disabled={!canImport || selectedResultIds.length === 0}
                  loading={importResults.isPending && importingResultId === null}
                  onClick={() => void runImport(selectedResultIds)}
                >
                  <Send className="h-4 w-4" aria-hidden />
                  Enviar para CRM ({selectedResultIds.length})
                </Button>
              </div>
            }
          />
          <CardContent className="space-y-4">
            {importSummary ? <ImportSummaryNotice summary={importSummary} /> : null}

            {resultsQuery.isLoading ? (
              <TableSkeleton rows={4} columns={3} />
            ) : resultsQuery.isError ? (
              <QueryErrorState
                title="Não foi possível carregar os resultados."
                error={resultsQuery.error}
                onRetry={() => {
                  void refetchResults();
                }}
              />
            ) : results.length === 0 ? (
              <EmptyState
                title={
                  currentSearch?.status === 'COMPLETED'
                    ? 'Nenhum resultado encontrado'
                    : 'A pesquisa ainda não tem resultados'
                }
                description={
                  currentSearch?.status === 'FAILED'
                    ? (currentSearch.error ?? 'A pesquisa não pôde ser concluída.')
                    : 'Os resultados aparecerão aqui quando o processamento terminar.'
                }
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos os resultados desta página"
                      checked={allCurrentResultsSelected}
                      onChange={toggleCurrentPage}
                      disabled={selectableResultIds.length === 0}
                      className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-brand-500 focus:ring-brand-400"
                    />
                    Selecionar todos
                  </label>
                  <p className="text-sm text-zinc-500">
                    <span className="font-medium text-amber-300">{withoutWebsiteCount}</span> sem site
                    {' · '}
                    <span className="font-medium text-zinc-300">
                      {resultPage?.meta.total ?? results.length}
                    </span>{' '}
                    total
                  </p>
                </div>

                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {results.map((result) => (
                    <li key={result.id}>
                      <SearchResultCard
                        result={result}
                        selected={selectedResultIds.includes(result.id)}
                        selectable={canImport && !result.importedLeadId}
                        importing={importingResultId === result.id}
                        onToggle={toggleResult}
                        onSendToCrm={(resultId) => void runImport([resultId], resultId)}
                      />
                    </li>
                  ))}
                </ul>

                {resultPage?.meta ? (
                  <Pagination {...resultPage.meta} onPageChange={changeResultsPage} />
                ) : null}
                <p className="text-xs text-zinc-500">
                  Dados ©{' '}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-zinc-200"
                  >
                    colaboradores do OpenStreetMap
                  </a>
                  , sob a ODbL.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Histórico de pesquisas"
          description="Selecione uma pesquisa para acompanhar resultados."
        />
        <CardContent>
          {searchesQuery.isLoading ? (
            <TableSkeleton rows={3} columns={4} />
          ) : searchesQuery.isError ? (
            <QueryErrorState
              title="Não foi possível carregar o histórico de pesquisas."
              error={searchesQuery.error}
              onRetry={() => {
                void searchesQuery.refetch();
              }}
            />
          ) : searches.length === 0 ? (
            <EmptyState
              title="Nenhuma pesquisa"
              description="Crie uma pesquisa para começar a encontrar empresas."
            />
          ) : (
            <div className="space-y-3">
              <ul className="divide-y divide-zinc-800" aria-label="Histórico de pesquisas">
                {searches.map((search) => (
                  <li key={search.id}>
                    <div className="flex items-start gap-2 py-3">
                      <button
                        type="button"
                        onClick={() => selectSearch(search.id)}
                        aria-pressed={search.id === selectedSearchId}
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left hover:bg-zinc-950 focus-visible:rounded-control"
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-zinc-50">
                            {formatSearchHeading(search.input)}
                          </span>
                          <span className="text-sm text-zinc-500">
                            {formatDateTime(search.createdAt)}
                          </span>
                        </span>
                        <Badge tone={statusTone(search.status)}>{STATUS_LABEL[search.status]}</Badge>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        aria-label={`Apagar pesquisa ${formatSearchHeading(search.input)}`}
                        loading={deleteSearch.isPending && deleteSearch.variables === search.id}
                        onClick={() => {
                          void removeSearch(search.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                    {search.status === 'FAILED' && search.error ? (
                      <p className="pb-3 text-sm text-red-300">{search.error}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {searchesQuery.data?.meta ? (
                <Pagination {...searchesQuery.data.meta} onPageChange={setHistoryPage} />
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
