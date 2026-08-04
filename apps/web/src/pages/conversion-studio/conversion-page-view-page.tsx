import { ArrowLeft, ExternalLink, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HtmlLandingRenderer } from '@/features/conversion-studio/components/html-landing-renderer';
import { PageBlocksRenderer } from '@/features/conversion-studio/components/page-blocks-renderer';
import {
  useConversionPage,
  usePublishConversionPage,
  useRefineLandingPage,
} from '@/features/conversion-studio/hooks';
import { pageBlocksSchema, type PageBlock } from '@/features/conversion-studio/types/blocks';
import { getApiErrorMessage } from '@/lib/api';

function parseDraftBlocks(raw: unknown): PageBlock[] {
  const parsed = pageBlocksSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export function ConversionPageViewPage() {
  const { id } = useParams<{ id: string }>();
  const pageQuery = useConversionPage(id, { pollGeneration: true });
  const publish = usePublishConversionPage(id ?? '');
  const refine = useRefineLandingPage(id ?? '');
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [chatLog, setChatLog] = useState<string[]>([]);

  const generating =
    pageQuery.data?.generationStatus === 'QUEUED' ||
    pageQuery.data?.generationStatus === 'RUNNING';

  useEffect(() => {
    if (pageQuery.data?.generationStatus === 'SUCCEEDED') {
      setInstruction('');
    }
  }, [pageQuery.data?.generationStatus, pageQuery.data?.draftRevision]);

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
  const html = page.draftHtml?.trim() || '';
  const hasHtml = Boolean(html);
  const isPublished = page.status === 'PUBLISHED';
  const leadName = page.lead?.companyName ?? page.title;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
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
                {generating
                  ? 'Gerando / a aplicar mudanças…'
                  : isPublished
                    ? 'Publicada — pronta para o cliente'
                    : 'Site pronto — refine com IA ou publique para o cliente'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                disabled={generating}
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
            {!hasHtml ? (
              <Link to={`/pages/${page.id}/edit`}>
                <Button size="sm" variant="ghost">
                  Ajustar
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <aside className="flex min-h-[28rem] flex-col rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="text-sm font-medium text-zinc-100">Seu site está pronto</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            {hasHtml
              ? 'Peça mudanças em linguagem natural. A IA reescreve o HTML com sanitização no servidor. Cada pedido consome 1 geração do plano.'
              : 'Peça mudanças em linguagem natural. Páginas legadas usam blocos; novas gerações usam HTML premium.'}
          </p>

          <div className="mt-4 flex-1 space-y-2 overflow-y-auto rounded-control border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-400">
            <p>
              Projeto: <span className="text-zinc-200">{page.title}</span>
            </p>
            <p>
              Formato:{' '}
              <span className="text-zinc-200">{hasHtml ? 'HTML premium' : 'Blocos (legado)'}</span>
            </p>
            <p>
              Modo: <span className="text-zinc-200">{page.generationMode ?? '—'}</span>
            </p>
            {page.generationError ? (
              <p className="text-amber-200">Aviso: {page.generationError}</p>
            ) : null}
            {generating ? <p className="text-brand-200">A processar…</p> : null}
            {chatLog.length > 0 ? (
              <ul className="space-y-1.5 border-t border-zinc-800 pt-2">
                {chatLog.map((item, index) => (
                  <li key={`${index}-${item.slice(0, 12)}`} className="text-zinc-300">
                    “{item}”
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                Exemplos: “deixe o hero mais direto”, “adicione FAQ sobre preço”, “destaque
                WhatsApp”.
              </p>
            )}
          </div>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const value = instruction.trim();
              if (!value || !id || generating) return;
              setActionError(null);
              setChatLog((prev) => [...prev, value].slice(-12));
              void refine
                .mutateAsync(value)
                .then(() => {
                  setInstruction('');
                  return pageQuery.refetch();
                })
                .catch((err) =>
                  setActionError(getApiErrorMessage(err) ?? 'Não foi possível refinar.'),
                );
            }}
          >
            <input
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              disabled={generating || refine.isPending}
              placeholder="Ex.: escureça o hero e destaque o WhatsApp"
              className="h-10 min-w-0 flex-1 rounded-control border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
            />
            <Button
              type="submit"
              size="sm"
              disabled={generating || refine.isPending || instruction.trim().length < 3}
              loading={refine.isPending}
            >
              <Send className="h-4 w-4" aria-hidden />
            </Button>
          </form>
        </aside>

        <main className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
          <h1 className="sr-only">{page.title}</h1>
          {!isPublished ? (
            <p className="rounded-control border border-brand-500/20 bg-brand-500/10 px-3 py-2 text-xs text-brand-100">
              Landing gerada para o lead. Publique e envie o link ao cliente da prospeção.
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
          {generating && !hasHtml && blocks.length === 0 ? (
            <Skeleton className="h-80" />
          ) : hasHtml ? (
            <HtmlLandingRenderer html={html} title={page.title} />
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
        </main>
      </div>
    </div>
  );
}
