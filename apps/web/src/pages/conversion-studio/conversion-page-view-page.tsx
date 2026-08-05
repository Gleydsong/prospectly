import { ArrowLeft, ExternalLink, Loader2, Send, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { HtmlLandingRenderer } from '@/features/conversion-studio/components/html-landing-renderer';
import { PageBlocksRenderer } from '@/features/conversion-studio/components/page-blocks-renderer';
import {
  useConversionPage,
  useEntitlements,
  usePublishConversionPage,
  useRefineLandingPage,
} from '@/features/conversion-studio/hooks';
import { pageBlocksSchema, type PageBlock } from '@/features/conversion-studio/types/blocks';
import {
  generationFormatLabel,
  generationModeLabel,
} from '@/features/conversion-studio/utils/generation-mode';
import { getApiErrorMessage } from '@/lib/api';

const PROMPT_SUGGESTIONS = [
  'Deixe o hero mais direto e destaque o WhatsApp',
  'Adicione uma seção de FAQ sobre preços e prazos',
  'Use um visual mais escuro e elegante',
  'Inclua depoimentos de clientes na página',
] as const;

function parseDraftBlocks(raw: unknown): PageBlock[] {
  const parsed = pageBlocksSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export function ConversionPageViewPage() {
  const { id } = useParams<{ id: string }>();
  const pageQuery = useConversionPage(id, { pollGeneration: true });
  const entitlements = useEntitlements();
  const publish = usePublishConversionPage(id ?? '');
  const refine = useRefineLandingPage(id ?? '');
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [chatLog, setChatLog] = useState<string[]>([]);

  const generating =
    pageQuery.data?.generationStatus === 'QUEUED' ||
    pageQuery.data?.generationStatus === 'RUNNING';
  const aiBusy = generating || refine.isPending;
  const aiRemaining =
    entitlements.data != null
      ? Math.max(0, entitlements.data.limits.aiGenerations - entitlements.data.usage.aiGenerations)
      : null;

  const submitInstruction = useCallback(async () => {
    const value = instruction.trim();
    if (!value || !id || aiBusy || value.length < 3) return;

    setActionError(null);
    setChatLog((prev) => [...prev, value].slice(-12));
    try {
      await refine.mutateAsync(value);
      setInstruction('');
      await pageQuery.refetch();
    } catch (err) {
      setActionError(getApiErrorMessage(err) ?? 'Não foi possível refinar.');
    }
  }, [aiBusy, id, instruction, pageQuery, refine]);

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
  const hasLegacyHtml = blocks.length === 0 && Boolean(page.draftHtml?.trim());
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
            {!isPublished && blocks.length === 0 ? (
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
        <aside className="flex max-h-[calc(100vh-5.5rem)] min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 lg:sticky lg:top-[4.5rem] lg:self-start">
          <div className="border-b border-zinc-800/80 bg-gradient-to-br from-brand-500/10 via-zinc-900/40 to-zinc-900/70 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-200">
                <Sparkles className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-50">Editar com React Aura</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  Descreva a mudança que quer ver no site. O React Aura reescreve os blocos e o preview
                  atualiza automaticamente.
                </p>
              </div>
            </div>
            {aiRemaining != null ? (
              <p className="mt-3 rounded-control border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 text-[11px] text-zinc-400">
                <span className="font-medium text-zinc-200">{aiRemaining}</span> geração(ões) de IA
                restante(s) no plano
              </p>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col p-4">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-control border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-400">
              <p>
                Projeto: <span className="text-zinc-200">{page.title}</span>
              </p>
              <p>
                Formato: <span className="text-zinc-200">{generationFormatLabel()}</span>
              </p>
              <p>
                Modo: <span className="text-zinc-200">{generationModeLabel(page.generationMode)}</span>
              </p>
              {chatLog.length === 0 ? (
                <div className="space-y-2 text-zinc-500">
                  <p className="font-medium text-zinc-400">Como funciona</p>
                  <ol className="list-decimal space-y-1 pl-4">
                    <li>Escreva o que quer mudar (tom, seções, CTA, cores).</li>
                    <li>Envie o pedido — cada envio usa 1 geração do plano.</li>
                    <li>Aguarde alguns segundos e confira o preview à direita.</li>
                  </ol>
                </div>
              ) : (
                <ul className="space-y-2">
                  {chatLog.map((item, index) => (
                    <li
                      key={`${index}-${item.slice(0, 12)}`}
                      className="rounded-control border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-200"
                    >
                      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                        Seu pedido
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {generating ? (
                <div className="mt-2 flex items-center gap-2 rounded-control border border-brand-500/20 bg-brand-500/10 px-3 py-2 text-xs text-brand-100">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  A IA está aplicando as mudanças…
                </div>
              ) : null}
              {page.generationError ? (
                <p className="mt-2 text-xs text-amber-200">Aviso: {page.generationError}</p>
              ) : null}
            </div>

            <div className="mt-3 space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Sugestões rápidas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PROMPT_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={aiBusy}
                    onClick={() => setInstruction(suggestion)}
                    className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-brand-400/40 hover:bg-brand-500/10 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <form
              className="mt-4 space-y-3 border-t border-zinc-800 pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitInstruction();
              }}
            >
              <Textarea
                label="O que você quer mudar?"
                name="ai-instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                disabled={aiBusy}
                rows={4}
                maxLength={1000}
                placeholder="Ex.: Troque o título do hero por algo mais direto, escureça o fundo e coloque o botão do WhatsApp em destaque no topo."
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    void submitInstruction();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-zinc-500">
                  {generationFormatLabel()}
                  {' · '}
                  {instruction.trim().length}/1000
                </p>
                <Button
                  type="submit"
                  size="sm"
                  disabled={aiBusy || instruction.trim().length < 3}
                  loading={refine.isPending}
                >
                  <Send className="h-4 w-4" aria-hidden />
                  Enviar para o React Aura
                </Button>
              </div>
            </form>
          </div>
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
          {generating && blocks.length === 0 ? (
            <Skeleton className="h-80" />
          ) : hasLegacyHtml ? (
            <HtmlLandingRenderer html={page.draftHtml ?? ''} title={page.title} />
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
