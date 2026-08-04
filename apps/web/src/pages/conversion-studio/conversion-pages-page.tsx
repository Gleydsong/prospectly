import { FilePlus2, Link2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PlanLimitsNotice } from '@/features/conversion-studio/components/plan-limits-notice';
import { ProjectCard } from '@/features/conversion-studio/components/project-card';
import { useConversionPages, useEntitlements } from '@/features/conversion-studio/hooks';
import {
  createDomainBinding,
  listDomainBindings,
  verifyDomainBinding,
} from '@/features/conversion-studio/services/api';
import { getApiErrorMessage } from '@/lib/api';

type DomainBindingRow = {
  id: string;
  hostname: string;
  verifiedAt?: string | null;
  verificationToken: string;
};

export function ConversionPagesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [hostname, setHostname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [domainNotice, setDomainNotice] = useState<string | null>(null);
  const [domainsOpen, setDomainsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const pages = useConversionPages();
  const entitlements = useEntitlements();

  const draftsBlocked = Boolean(
    entitlements.data &&
      entitlements.data.usage.pageDrafts >= entitlements.data.limits.pageDrafts,
  );

  const domains = useQuery({
    queryKey: ['conversion-pages', 'domains'],
    queryFn: listDomainBindings,
    enabled: Boolean(entitlements.data?.features.custom_domain) && domainsOpen,
  });

  const filtered = useMemo(() => {
    const rows = pages.data?.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((page) => {
      const haystack = [page.title, page.lead?.companyName, page.lead?.city, page.lead?.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [pages.data?.data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Meus projetos</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Landings já prontas a partir dos leads. Abra para ver o site e publique para o cliente da
            prospeção.
          </p>
        </div>
        <Button disabled={draftsBlocked} onClick={() => navigate('/pages/new')}>
          <FilePlus2 className="h-4 w-4" aria-hidden />
          Novo projeto
        </Button>
      </div>

      <PlanLimitsNotice />

      {error ? (
        <p className="rounded-control bg-red-500/10 p-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <section className="space-y-4" aria-labelledby="projects-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="projects-heading" className="sr-only">
            Projetos
          </h2>
          <div className="relative w-full sm:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden
            />
            <Input
              aria-label="Buscar projeto"
              placeholder="Buscar projeto…"
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <p className="text-xs text-zinc-500">Última edição · mais recentes primeiro</p>
        </div>

        {pages.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : pages.isError ? (
          <p className="rounded-control bg-red-500/10 p-3 text-sm text-red-300">
            {getApiErrorMessage(pages.error)}
          </p>
        ) : !pages.data || pages.data.data.length === 0 ? (
          <EmptyState
            title="Ainda não há projetos"
            description="Escolha um lead do CRM e gere a landing pronta — depois é só publicar para o cliente."
            action={
              <Button disabled={draftsBlocked} onClick={() => navigate('/pages/new')}>
                <FilePlus2 className="h-4 w-4" aria-hidden />
                Criar primeiro projeto
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nenhum projeto encontrado"
            description="Tente outro termo de busca."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((page) => (
              <ProjectCard key={page.id} page={page} />
            ))}
          </ul>
        )}
      </section>

      {entitlements.data?.features.custom_domain ? (
        <details
          className="rounded-control border border-zinc-800 bg-zinc-900/40"
          open={domainsOpen}
          onToggle={(event) => setDomainsOpen((event.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-200 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <Link2 className="h-4 w-4 text-zinc-500" aria-hidden />
              Domínio personalizado
              <span className="font-normal text-zinc-500">(opcional)</span>
            </span>
          </summary>
          <div className="space-y-3 border-t border-zinc-800 px-4 py-4">
            <p className="text-sm text-zinc-400">
              Aponte um hostname seu e confirme o TXT DNS. Não é necessário para publicar em{' '}
              <code className="text-zinc-300">/p/seu-slug</code>.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                label="Hostname"
                placeholder="proposta.cliente.com"
                value={hostname}
                onChange={(event) => setHostname(event.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDomainNotice(null);
                  void createDomainBinding({ hostname: hostname.trim() })
                    .then(async (binding) => {
                      setHostname('');
                      setDomainNotice(
                        `Registe TXT: prospectly-verify=${(binding as DomainBindingRow).verificationToken}`,
                      );
                      await queryClient.invalidateQueries({
                        queryKey: ['conversion-pages', 'domains'],
                      });
                    })
                    .catch((err) =>
                      setError(getApiErrorMessage(err) ?? 'Falha ao criar domínio.'),
                    );
                }}
              >
                Adicionar domínio
              </Button>
            </div>
            {domainNotice ? (
              <p className="rounded-control bg-brand-500/15 p-3 text-sm text-brand-200" role="status">
                {domainNotice}
              </p>
            ) : null}
            <ul className="space-y-2 text-sm text-zinc-300">
              {((domains.data as DomainBindingRow[] | undefined) ?? []).map((binding) => (
                <li
                  key={binding.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-zinc-800 p-3"
                >
                  <div>
                    <p>{binding.hostname}</p>
                    <p className="text-xs text-zinc-500">
                      {binding.verifiedAt
                        ? 'Verificado'
                        : `TXT: prospectly-verify=${binding.verificationToken}`}
                    </p>
                  </div>
                  {!binding.verifiedAt ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        void verifyDomainBinding(binding.id)
                          .then(async () => {
                            setDomainNotice(`${binding.hostname} verificado.`);
                            await queryClient.invalidateQueries({
                              queryKey: ['conversion-pages', 'domains'],
                            });
                          })
                          .catch((err) =>
                            setError(getApiErrorMessage(err) ?? 'DNS ainda não bate.'),
                          );
                      }}
                    >
                      Verificar DNS
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </div>
  );
}
