import { Trash2 } from 'lucide-react';
import { type MouseEvent } from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageBlocksRenderer } from '@/features/conversion-studio/components/page-blocks-renderer';
import { useArchiveConversionPage } from '@/features/conversion-studio/hooks';
import type { ConversionPageSummary } from '@/features/conversion-studio/services/api';
import { pageBlocksSchema, type PageBlock } from '@/features/conversion-studio/types/blocks';
import { getApiErrorMessage } from '@/lib/api';
import { cn, formatRelativeTime } from '@/lib/utils';

const STATUS_LABEL = {
  DRAFT: 'Rascunho',
  PREVIEW: 'Pré-visualização',
  PUBLISHED: 'Publicada',
  ARCHIVED: 'Arquivada',
} as const;

const STATUS_TONE = {
  DRAFT: 'slate',
  PREVIEW: 'amber',
  PUBLISHED: 'green',
  ARCHIVED: 'blue',
} as const;

function previewBlocks(raw: unknown): PageBlock[] {
  const parsed = pageBlocksSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.slice(0, 5);
}

export function ProjectCard({ page }: { page: ConversionPageSummary }) {
  const name = page.lead?.companyName ?? page.title;
  const place = [page.lead?.category, page.lead?.city].filter(Boolean).join(' · ');
  const blocks = previewBlocks(page.draftBlocks);
  const archive = useArchiveConversionPage();

  async function handleDelete(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (archive.isPending) return;

    const confirmed = window.confirm(
      `Apagar o projeto “${name}”? Esta ação remove o site da lista de Meus projetos.`,
    );
    if (!confirmed) return;

    try {
      await archive.mutateAsync(page.id);
    } catch (error) {
      window.alert(getApiErrorMessage(error) || 'Não foi possível apagar o projeto.');
    }
  }

  return (
    <li className="relative">
      <Link
        to={`/pages/${page.id}/view`}
        className={cn(
          'group block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-soft',
          'transition-colors hover:border-zinc-700 hover:bg-zinc-900',
        )}
      >
        <div className="relative h-44 overflow-hidden border-b border-zinc-800 bg-zinc-950">
          {page.hasHtml ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-900 via-zinc-950 to-amber-950/40 px-6 text-center">
              <p className="text-sm font-medium text-zinc-200">Site HTML premium</p>
              <p className="text-xs text-zinc-500">Pré-visualização completa na página do projeto</p>
            </div>
          ) : blocks.length > 0 ? (
            <div
              className="pointer-events-none absolute inset-0 origin-top-left scale-[0.42] p-4"
              style={{ width: '238%' }}
            >
              <PageBlocksRenderer blocks={blocks} />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 px-6 text-center">
              <p className="text-sm text-zinc-500">Pré-visualização indisponível</p>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-950 to-transparent" />
        </div>

        <div className="space-y-2 px-4 py-3.5">
          <div className="flex items-start justify-between gap-2 pr-8">
            <div className="min-w-0">
              <p className="truncate font-medium text-zinc-50 group-hover:underline">{name}</p>
              {place ? <p className="truncate text-xs text-zinc-500">{place}</p> : null}
            </div>
            <Badge tone={STATUS_TONE[page.status]}>{STATUS_LABEL[page.status]}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
              {page.hasHtml ? 'HTML premium' : 'Site simples'}
            </span>
            <span>Editado {formatRelativeTime(page.updatedAt)}</span>
          </div>
        </div>
      </Link>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        loading={archive.isPending}
        aria-label={`Apagar projeto ${name}`}
        title="Apagar projeto"
        onClick={handleDelete}
        className={cn(
          'absolute right-2 top-2 z-10 h-8 w-8 rounded-full p-0',
          'border border-zinc-700/80 bg-zinc-950/80 text-zinc-300 shadow-soft backdrop-blur',
          'hover:border-red-500/50 hover:bg-red-950/70 hover:text-red-300',
        )}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
    </li>
  );
}
