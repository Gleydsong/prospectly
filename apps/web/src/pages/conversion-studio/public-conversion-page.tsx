import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { PageBlocksRenderer } from '@/features/conversion-studio/components/page-blocks-renderer';
import {
  fetchPublicPage,
  submitPublicForm,
  trackPublicEvent,
} from '@/features/conversion-studio/services/api';
import { pageBlocksSchema, type PageBlock } from '@/features/conversion-studio/types/blocks';

export function PublicConversionPage() {
  const { slug } = useParams<{ slug: string }>();
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      try {
        const page = await fetchPublicPage(slug);
        if (cancelled) return;
        const parsed = pageBlocksSchema.safeParse(page.blocks);
        setTitle(page.title);
        setBlocks(parsed.success ? parsed.data : []);
        await trackPublicEvent(slug, { type: 'page_view' });
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
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <h1 className="sr-only">{heading}</h1>
        {success ? (
          <p className="rounded-lg bg-emerald-500/15 p-3 text-sm text-emerald-200" role="status">
            {success}
          </p>
        ) : null}
        <PageBlocksRenderer
          blocks={blocks}
          onTrack={(ctaType) => {
            if (!slug) return;
            void trackPublicEvent(slug, { type: 'cta_click', ctaType });
          }}
          onSubmitForm={async (payload) => {
            if (!slug) return;
            const result = await submitPublicForm(slug, payload);
            setSuccess(result.message ?? 'Recebemos o seu contacto.');
          }}
        />
      </div>
    </main>
  );
}
