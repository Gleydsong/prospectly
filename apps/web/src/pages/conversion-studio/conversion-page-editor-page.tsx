import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/lib/api';

import { PageEditorWorkspace } from '@/features/conversion-studio/components/page-editor-workspace';
import {
  useConversionPage,
  useEntitlements,
  usePageMetrics,
  usePublishConversionPage,
  useRestoreConversionVersion,
  useUpdateConversionDraft,
} from '@/features/conversion-studio/hooks';
import {
  listPageAssets,
  registerPageAsset,
  updatePageAnalytics,
} from '@/features/conversion-studio/services/api';
import { pageBlocksSchema, type PageBlock } from '@/features/conversion-studio/types/blocks';

export function ConversionPageEditorPage() {
  const { id } = useParams<{ id: string }>();
  const pageQuery = useConversionPage(id);
  const entitlements = useEntitlements();
  const metrics = usePageMetrics(id);
  const updateDraft = useUpdateConversionDraft(id ?? '');
  const publish = usePublishConversionPage(id ?? '');
  const restore = useRestoreConversionVersion(id ?? '');

  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [revision, setRevision] = useState(1);
  const [baseline, setBaseline] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [assetUrl, setAssetUrl] = useState('');
  const [assetAlt, setAssetAlt] = useState('');
  const [pixelEnabled, setPixelEnabled] = useState(false);
  const [consentLabel, setConsentLabel] = useState('');
  const queryClient = useQueryClient();

  const assetsQuery = useQuery({
    queryKey: ['conversion-pages', id, 'assets'],
    queryFn: () => listPageAssets(id!),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!pageQuery.data) return;
    const parsed = pageBlocksSchema.safeParse(pageQuery.data.draftBlocks);
    const nextBlocks = parsed.success ? parsed.data : [];
    setTitle(pageQuery.data.title);
    setBlocks(nextBlocks);
    setRevision(pageQuery.data.draftRevision);
    setBaseline(JSON.stringify({ title: pageQuery.data.title, blocks: nextBlocks }));
    const pageData = pageQuery.data as {
      analyticsPixelEnabled?: boolean;
      analyticsConsentLabel?: string | null;
    };
    setPixelEnabled(Boolean(pageData.analyticsPixelEnabled));
    setConsentLabel(pageData.analyticsConsentLabel ?? '');
  }, [pageQuery.data]);

  const dirty = useMemo(
    () => JSON.stringify({ title, blocks }) !== baseline,
    [title, blocks, baseline],
  );

  if (pageQuery.isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (pageQuery.isError || !pageQuery.data) {
    return (
      <EmptyState
        title="Página não encontrada"
        description={getApiErrorMessage(pageQuery.error) ?? 'Não foi possível carregar o projeto.'}
      />
    );
  }

  async function handleSave() {
    setError(null);
    try {
      const saved = await updateDraft.mutateAsync({
        title,
        blocks,
        expectedRevision: revision,
      });
      setRevision(saved.draftRevision);
      setBaseline(JSON.stringify({ title: saved.title, blocks }));
      setNotice('Rascunho salvo.');
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Falha ao salvar rascunho.');
    }
  }

  async function handlePublish() {
    setError(null);
    try {
      if (dirty) await handleSave();
      await publish.mutateAsync();
      setNotice('Página publicada.');
    } catch (err) {
      setError(getApiErrorMessage(err) ?? 'Falha ao publicar.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Conversion Studio</p>
          <h1 className="text-2xl font-semibold text-zinc-50">{pageQuery.data.title}</h1>
          <p className="text-sm text-zinc-500">
            Status: {pageQuery.data.status}
            {pageQuery.data.publicSlug ? (
              <>
                {' '}
                ·{' '}
                <Link className="text-brand-300 underline" to={`/p/${pageQuery.data.publicSlug}`} target="_blank">
                  Página pública
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {entitlements.data ? (
          <Card className="min-w-[220px]">
            <CardContent className="p-3 text-sm text-zinc-300">
              Publicadas: {entitlements.data.usage.publishedPages}/{entitlements.data.limits.publishedPages}
              <br />
              Rascunhos: {entitlements.data.usage.pageDrafts}/{entitlements.data.limits.pageDrafts}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg bg-brand-500/15 p-3 text-sm text-brand-200" role="status">
          {notice}
        </p>
      ) : null}

      <PageEditorWorkspace
        title={title}
        blocks={blocks}
        selectedId={selectedId}
        previewMode={previewMode}
        dirty={dirty}
        saving={updateDraft.isPending}
        publishing={publish.isPending}
        onTitleChange={setTitle}
        onBlocksChange={setBlocks}
        onSelect={setSelectedId}
        onPreviewModeChange={setPreviewMode}
        onSave={() => void handleSave()}
        onPublish={() => void handlePublish()}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Versões" />
          <CardContent className="space-y-2">
            {pageQuery.data.versions.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhuma versão publicada ainda.</p>
            ) : (
              pageQuery.data.versions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between gap-3 rounded-control border border-zinc-800 p-3"
                >
                  <div>
                    <p className="text-sm text-zinc-100">v{version.version}</p>
                    <p className="text-xs text-zinc-500">{version.changeNote ?? '—'}</p>
                  </div>
                  <button
                    type="button"
                    className="min-h-11 rounded-control px-3 text-sm text-brand-300 hover:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
                    onClick={() => void restore.mutateAsync(version.version)}
                  >
                    Restaurar
                  </button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Métricas (30 dias)" />
          <CardContent className="space-y-2 text-sm text-zinc-300">
            {!metrics.data ? (
              <Skeleton className="h-24" />
            ) : (
              <>
                <p>Visitas: {metrics.data.views}</p>
                <p>Cliques CTA: {metrics.data.ctaClicks}</p>
                <p>Formulários: {metrics.data.formSubmitted}</p>
                <p>Taxa de conversão: {metrics.data.conversionRate}%</p>
                <p>CTA mais acionado: {metrics.data.topCtaType ?? '—'}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Assets (URL HTTPS)" description="Sem upload binário local — filesystem efêmero no Render." />
          <CardContent className="space-y-3">
            <Input label="URL HTTPS" value={assetUrl} onChange={(event) => setAssetUrl(event.target.value)} />
            <Input label="Texto alternativo" value={assetAlt} onChange={(event) => setAssetAlt(event.target.value)} />
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (!id || !assetUrl.trim()) return;
                void registerPageAsset(id, { url: assetUrl.trim(), altText: assetAlt.trim() || undefined })
                  .then(async () => {
                    setAssetUrl('');
                    setAssetAlt('');
                    await queryClient.invalidateQueries({ queryKey: ['conversion-pages', id, 'assets'] });
                    setNotice('Asset registado.');
                  })
                  .catch((err) => setError(getApiErrorMessage(err) ?? 'Falha ao registar asset.'));
              }}
            >
              Registar asset
            </Button>
            <ul className="space-y-2 text-sm text-zinc-400">
              {(assetsQuery.data as Array<{ id: string; url: string; altText?: string | null }> | undefined)?.map(
                (asset) => (
                  <li key={asset.id} className="truncate">
                    {asset.altText ? `${asset.altText}: ` : ''}
                    {asset.url}
                  </li>
                ),
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Métricas com consentimento" />
          <CardContent className="space-y-3">
            <label className="flex min-h-11 items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={pixelEnabled}
                onChange={(event) => setPixelEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 text-brand-400 focus:ring-brand-400"
              />
              Pedir consentimento para métricas na página pública
            </label>
            <Input
              label="Texto de consentimento"
              value={consentLabel}
              onChange={(event) => setConsentLabel(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (!id) return;
                void updatePageAnalytics(id, {
                  analyticsPixelEnabled: pixelEnabled,
                  analyticsConsentLabel: consentLabel,
                })
                  .then(async () => {
                    await pageQuery.refetch();
                    setNotice('Definições de métricas atualizadas.');
                  })
                  .catch((err) => setError(getApiErrorMessage(err) ?? 'Falha ao guardar analytics.'));
              }}
            >
              Guardar analytics
            </Button>
            {entitlements.data && !entitlements.data.features.analytics_pixel ? (
              <p className="text-xs text-amber-300">Plano atual sem analytics_pixel — upgrade necessário para ativar.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
