import { FilePlus2 } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { FeatureGateBanner } from '@/features/conversion-studio/components/feature-gate-banner';
import { useConversionPages, useCreateConversionPage, useEntitlements } from '@/features/conversion-studio/hooks';
import {
  createDomainBinding,
  listDomainBindings,
  verifyDomainBinding,
} from '@/features/conversion-studio/services/api';
import { getApiErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

type DomainBindingRow = {
  id: string;
  hostname: string;
  verifiedAt?: string | null;
  verificationToken: string;
};

export function ConversionPagesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('Nova proposta');
  const [hostname, setHostname] = useState('');
  const pages = useConversionPages();
  const entitlements = useEntitlements();
  const createPage = useCreateConversionPage();
  const [error, setError] = useState<string | null>(null);
  const [domainNotice, setDomainNotice] = useState<string | null>(null);

  const domains = useQuery({
    queryKey: ['conversion-pages', 'domains'],
    queryFn: listDomainBindings,
    enabled: Boolean(entitlements.data?.features.custom_domain),
  });

  async function handleCreate() {
    setError(null);
    try {
      const page = await createPage.mutateAsync({ title: title.trim() || 'Nova proposta' });
      navigate(`/pages/${page.id}/edit`);
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Não foi possível criar a página.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Conversion Studio</h1>
        <p className="text-sm text-zinc-500">
          Crie páginas de proposta vinculadas a leads e acompanhe a conversão.
        </p>
      </div>

      <FeatureGateBanner feature="page_drafts" />
      <FeatureGateBanner feature="published_pages" />
      <FeatureGateBanner feature="custom_domain" />

      {entitlements.data ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-zinc-300">
            <span>
              Plano {entitlements.data.plan}: {entitlements.data.usage.publishedPages}/
              {entitlements.data.limits.publishedPages} páginas publicadas
            </span>
            <Link to="/settings" className="text-brand-300 underline">
              Ver planos
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Novo projeto" />
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input label="Título" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Button loading={createPage.isPending} onClick={() => void handleCreate()}>
            <FilePlus2 className="h-4 w-4" aria-hidden />
            Criar página
          </Button>
        </CardContent>
      </Card>

      {entitlements.data?.features.custom_domain ? (
        <Card>
          <CardHeader
            title="Domínios personalizados"
            description="Crie um TXT prospectly-verify=<token> e depois verifique."
          />
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                label="Hostname"
                placeholder="proposta.cliente.com"
                value={hostname}
                onChange={(event) => setHostname(event.target.value)}
              />
              <Button
                type="button"
                onClick={() => {
                  setDomainNotice(null);
                  void createDomainBinding({ hostname: hostname.trim() })
                    .then(async (binding) => {
                      setHostname('');
                      setDomainNotice(
                        `Registe TXT: prospectly-verify=${(binding as DomainBindingRow).verificationToken}`,
                      );
                      await queryClient.invalidateQueries({ queryKey: ['conversion-pages', 'domains'] });
                    })
                    .catch((err) => setError(getApiErrorMessage(err) ?? 'Falha ao criar domínio.'));
                }}
              >
                Adicionar domínio
              </Button>
            </div>
            {domainNotice ? (
              <p className="rounded-lg bg-brand-500/15 p-3 text-sm text-brand-200" role="status">
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
                          .catch((err) => setError(getApiErrorMessage(err) ?? 'DNS ainda não bate.'));
                      }}
                    >
                      Verificar DNS
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader title="Projetos" />
        <CardContent>
          {pages.isLoading ? (
            <Skeleton className="h-40" />
          ) : pages.isError ? (
            <p className="text-sm text-red-300">{getApiErrorMessage(pages.error)}</p>
          ) : !pages.data || pages.data.data.length === 0 ? (
            <EmptyState
              title="Nenhuma página ainda"
              description="Crie uma proposta a partir de um lead ou comece um projeto em branco."
            />
          ) : (
            <ul className="divide-y divide-zinc-800 rounded-control border border-zinc-800">
              {pages.data.data.map((page) => (
                <li key={page.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <Link to={`/pages/${page.id}/edit`} className="font-medium text-zinc-50 hover:underline">
                      {page.title}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {page.status}
                      {page.lead ? ` · ${page.lead.companyName}` : ''} · {formatDateTime(page.updatedAt)}
                    </p>
                  </div>
                  <Link
                    to={`/pages/${page.id}/edit`}
                    className="min-h-11 rounded-control px-3 py-2 text-sm text-brand-300 hover:bg-zinc-900"
                  >
                    Editar
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
