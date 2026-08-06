import { ArrowLeft, ExternalLink, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HtmlLandingRenderer } from '@/features/conversion-studio/components/html-landing-renderer';
import { PageBlocksRenderer } from '@/features/conversion-studio/components/page-blocks-renderer';
import {
  useConversionPage,
  usePublishConversionPage,
} from '@/features/conversion-studio/hooks';
import { pageBlocksSchema, type PageBlock } from '@/features/conversion-studio/types/blocks';
import { getApiErrorMessage } from '@/lib/api';

function parseDraftBlocks(raw: unknown): PageBlock[] {
  const parsed = pageBlocksSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export function ConversionPageViewPage() {
  const { id } = useParams<{ id: string }>();
  const pageQuery = useConversionPage(id);
  const publish = usePublishConversionPage(id ?? '');
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (pageQuery.isLoading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64" />
          <Skeleton className="h-40" />
        </div>
      </main>
    );
  }

  if (pageQuery.isError || !pageQuery.data) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <p className="text-red-300" role="alert">
          {getApiErrorMessage(pageQuery.error) ?? 'Página não encontrada.'}
        </p>
        <Link to="/pages">
          <Button variant="secondary">Voltar aos projetos</Button>
        </Link>
      </main>
    );
  }

  const page = pageQuery.data;
  const blocks = parseDraftBlocks(page.draftBlocks);
  const hasLegacyHtml = blocks.length === 0 && Boolean(page.draftHtml?.trim());
  const isPublished = page.status === 'PUBLISHED';
  const leadName = page.lead?.companyName ?? page.title;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/pages">
              <Button size="sm" variant="ghost">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Projetos
              </Button>
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-100">{leadName}</p>
              <p className="text-xs text-zinc-500">
                {isPublished
                  ? 'Publicada — pronta para o cliente'
                  : 'Rascunho — edite os blocos ou publique para o cliente'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/pages/${page.id}/edit`}>
              <Button size="sm" variant="secondary">
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Editar blocos
              </Button>
            </Link>
            {isPublished ? (
              <Link to={`/p/${page.publicSlug}`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="secondary">
                  Link do cliente
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </Link>
            ) : (
              <Button
                size="sm"
                loading={publish.isPending}
                onClick={() => {
                  setActionError(null);
                  void publish
                    .mutateAsync()
                    .then(() => pageQuery.refetch())
                    .catch((err) =>
                      setActionError(getApiErrorMessage(err) ?? 'Não foi possível publicar.'),
                    );
                }}
              >
                Publicar para o cliente
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <h1 className="sr-only">{page.title}</h1>
        {!isPublished ? (
          <p className="rounded-control border border-brand-500/20 bg-brand-500/10 px-3 py-2 text-xs text-brand-100">
            Preview do rascunho. Edite os blocos e publique quando quiser enviar o link ao cliente.
          </p>
        ) : (
          <p className="rounded-control border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            Página no ar. Partilhe{' '}
            <Link
              className="underline"
              to={`/p/${page.publicSlug}`}
              target="_blank"
              rel="noreferrer"
            >
              /p/{page.publicSlug}
            </Link>
            .
          </p>
        )}
        {actionError ? (
          <p className="rounded-control bg-red-500/10 px-3 py-2 text-xs text-red-300" role="alert">
            {actionError}
          </p>
        ) : null}
        {formNotice ? (
          <p className="rounded-control bg-zinc-900 px-3 py-2 text-xs text-zinc-300" role="status">
            {formNotice}
          </p>
        ) : null}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
          {hasLegacyHtml ? (
            <HtmlLandingRenderer html={page.draftHtml ?? ''} title={page.title} />
          ) : blocks.length === 0 ? (
            <div className="rounded-control border border-dashed border-zinc-700 px-4 py-16 text-center">
              <p className="text-sm text-zinc-300">Nenhum bloco ainda</p>
              <p className="mt-1 text-xs text-zinc-500">Abra o editor para montar a página.</p>
              <Link to={`/pages/${page.id}/edit`} className="mt-4 inline-block">
                <Button size="sm">Editar blocos</Button>
              </Link>
            </div>
          ) : (
            <PageBlocksRenderer
              blocks={blocks}
              onSubmitForm={async () => {
                setFormNotice(
                  isPublished
                    ? 'Use o link público para testar o formulário.'
                    : 'Publique a página para ativar o formulário.',
                );
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
