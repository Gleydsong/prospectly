import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { HtmlLandingRenderer } from '@/features/conversion-studio/components/html-landing-renderer';
import { PageBlocksRenderer } from '@/features/conversion-studio/components/page-blocks-renderer';
import {
  fetchPublicPage,
  submitPublicForm,
  trackPublicEvent,
} from '@/features/conversion-studio/services/api';
import type { ConversionPageTemplate } from '@/features/conversion-studio/services/api';
import { pageBlocksSchema, type PageBlock } from '@/features/conversion-studio/types/blocks';

const CONSENT_KEY_PREFIX = 'prospectly.page.consent.';

export function PublicConversionPage() {
  const { slug } = useParams<{ slug: string }>();
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('');
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [template, setTemplate] = useState<ConversionPageTemplate>('HTML');
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [consentLabel, setConsentLabel] = useState('');
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      try {
        const page = await fetchPublicPage(slug);
        if (cancelled) return;
        const parsed = pageBlocksSchema.safeParse(page.blocks);
        setTitle(page.title);
        setHtml(page.html?.trim() || '');
        setBlocks(parsed.success ? parsed.data : []);
        setTemplate(page.template ?? 'HTML');
        setAnalyticsEnabled(Boolean(page.analytics?.enabled));
        setConsentLabel(page.analytics?.consentLabel ?? '');
        const stored = localStorage.getItem(`${CONSENT_KEY_PREFIX}${slug}`) === '1';
        setConsented(stored);
        if (!page.analytics?.enabled || stored) {
          await trackPublicEvent(slug, { type: 'page_view' });
        }
      } catch {
        if (!cancelled) setError('Página não encontrada.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const heading = useMemo(() => title || 'Proposta', [title]);
  const showConsent = analyticsEnabled && !consented;
  const hasLegacyHtml = blocks.length === 0 && template === 'HTML' && Boolean(html);

  if (loading) {
    return <p className="p-8 text-zinc-400">A carregar…</p>;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p className="text-red-300" role="alert">
          {error}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <div
        className={
          hasLegacyHtml
            ? 'mx-auto max-w-5xl space-y-4 px-2 py-4 sm:px-4 sm:py-8'
            : 'mx-auto max-w-3xl space-y-6 px-4 py-10'
        }
      >
        <h1 className="sr-only">{heading}</h1>
        {showConsent ? (
          <div
            className="rounded-control border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-300"
            role="dialog"
            aria-label="Consentimento de métricas"
          >
            <p>{consentLabel}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!slug) return;
                  localStorage.setItem(`${CONSENT_KEY_PREFIX}${slug}`, '1');
                  setConsented(true);
                  void trackPublicEvent(slug, { type: 'page_view' });
                }}
              >
                Aceitar métricas
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setConsented(true)}
              >
                Continuar sem métricas
              </Button>
            </div>
          </div>
        ) : null}
        {success ? (
          <p className="rounded-lg bg-emerald-500/15 p-3 text-sm text-emerald-200" role="status">
            {success}
          </p>
        ) : null}
        {submitError ? (
          <p className="rounded-lg bg-red-500/15 p-3 text-sm text-red-200" role="alert">
            {submitError}
          </p>
        ) : null}
        {hasLegacyHtml ? (
          <HtmlLandingRenderer
            html={html}
            title={heading}
            onFormSubmit={async (payload) => {
              if (!slug) return;
              try {
                setSubmitError(null);
                const result = await submitPublicForm(slug, payload);
                setSuccess(result.message ?? 'Recebemos o seu contacto.');
              } catch {
                setSuccess(null);
                setSubmitError('Não foi possível enviar o formulário. Tente novamente.');
              }
            }}
          />
        ) : (
          <PageBlocksRenderer
            blocks={blocks}
            onTrack={(ctaType) => {
              if (!slug) return;
              if (analyticsEnabled && !consented) return;
              void trackPublicEvent(slug, { type: 'cta_click', ctaType });
            }}
            onSubmitForm={async (payload) => {
              if (!slug) return;
              try {
                setSubmitError(null);
                const result = await submitPublicForm(slug, payload);
                setSuccess(result.message ?? 'Recebemos o seu contacto.');
              } catch {
                setSuccess(null);
                setSubmitError('Não foi possível enviar o formulário. Tente novamente.');
              }
            }}
          />
        )}
      </div>
    </main>
  );
}
