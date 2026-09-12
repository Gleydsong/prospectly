import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Search, X } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useBillingStatus } from '@/features/billing/hooks';
import { planLabel, SearchQuotaBanner } from '@/features/prospecting/components/search-quota-banner';
import {
  useCreateSearch,
  useGeoCities,
  useGeoRegions,
  useProspectingCategories,
} from '@/features/prospecting/hooks';
import { CATEGORY_LABEL } from '@/features/prospecting/search-presentation';
import { getApiErrorMessage } from '@/lib/api';
import {
  CREDIT_COSTS,
  PROSPECTING_CATEGORIES,
  PROSPECTING_CATEGORY_VALUES,
  PROSPECTING_COUNTRIES,
  PROSPECTING_COUNTRY_CODES,
  type ProspectingCategory,
  type ProspectingCategoryOption,
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

type SearchFormValues = z.infer<typeof searchSchema>;

export function SearchForm({
  actionError,
  onBeforeSubmit,
  onCreated,
  onError,
}: {
  actionError: string | null;
  onBeforeSubmit: () => void;
  onCreated: (searchId: string) => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const categoriesQuery = useProspectingCategories();
  const billingQuery = useBillingStatus();
  const createSearch = useCreateSearch();

  const categoryOptions: ProspectingCategoryOption[] =
    categoriesQuery.data?.categories ??
    PROSPECTING_CATEGORIES.map((category) => ({ ...category, available: true }));
  const plan = categoriesQuery.data?.plan ?? billingQuery.data?.plan;
  const availableCategoryCount = categoriesQuery.data?.availableCount ?? categoryOptions.length;
  const creditBalance = billingQuery.data?.creditBalance ?? 0;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      categories: [],
      country: 'BR',
      city: '',
      neighborhood: '',
      state: '',
      onlyWithoutWebsite: false,
    },
  });

  const selectedCountry = watch('country');
  const selectedCategories = watch('categories');
  const selectedRegion = watch('state');
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

  const onSubmit = async (values: SearchFormValues) => {
    onBeforeSubmit();
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
        onlyWithoutWebsite: values.onlyWithoutWebsite,
        ...(neighborhood ? { neighborhood } : {}),
      });
      onCreated(search.id);
    } catch (error) {
      onError(getApiErrorMessage(error));
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-5 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
              {t('search.highIntentEyebrow')}
            </p>
            <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight text-[color:var(--ink)] sm:text-3xl">
              {t('search.highIntentTitle')}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-muted)]">
              {t('search.highIntentDesc')}
            </p>
          </div>
          <div className="shrink-0">
            <SearchQuotaBanner usage={billingQuery.data?.searchUsage} plan={plan} />
          </div>
        </div>

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
              <option key="default-region" value="">
                {regionsQuery.isLoading ? 'Carregando…' : 'Selecione o estado'}
              </option>
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
              <option key="default-city" value="">
                {!selectedRegion
                  ? 'Selecione o estado'
                  : citiesQuery.isLoading
                    ? 'Carregando…'
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
              <option key="default-niche" value="">
                Selecione o nicho
              </option>
              {categoryOptions.map((category) => (
                <option key={category.value} value={category.value} disabled={!category.available}>
                  {CATEGORY_LABEL[category.value] ?? category.label}
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 py-1 pl-3 pr-1 text-xs font-medium text-[color:var(--accent)]">
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
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--ink)]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[color:var(--border)] bg-[color:var(--surface-card)] text-brand-500 focus:ring-[color:var(--ring)]"
                {...register('onlyWithoutWebsite')}
              />
              Somente empresas sem site informado
            </label>
            <p className="text-xs text-[color:var(--ink-muted)]">
              Cada busca consome {CREDIT_COSTS.mapsSearch} créditos após as buscas grátis.
            </p>
          </div>

          {actionError ? (
            <p className="rounded-control bg-red-500/10 p-3 text-sm text-red-300" role="alert">
              {actionError}
            </p>
          ) : null}
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--border)] pt-3 text-xs text-[color:var(--ink-muted)]">
          <p className="flex items-center gap-1.5">
            {availableCategoryCount < categoryOptions.length ? (
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : null}
            <span>
              {availableCategoryCount} de {categoryOptions.length} nichos disponíveis no plano{' '}
              {planLabel(plan)}
              {creditBalance > 0 && availableCategoryCount < categoryOptions.length
                ? ` · Seus ${creditBalance} créditos podem ser usados nos nichos liberados.`
                : ''}
            </span>
          </p>
          <Link to="/credits" className="font-semibold text-[color:var(--accent)] hover:underline">
            {availableCategoryCount < categoryOptions.length
              ? 'Desbloquear todos os nichos →'
              : 'Ver todos os planos →'}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
