import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { BLOCK_LIBRARY, createBlock, type PageBlock, type PageBlockType } from '../types/blocks';
import { moveBlock } from '../utils/blocks';
import { PageBlocksRenderer } from './page-blocks-renderer';

export function PageEditorWorkspace({
  title,
  blocks,
  selectedId,
  previewMode,
  dirty,
  saving,
  publishing,
  onTitleChange,
  onBlocksChange,
  onSelect,
  onPreviewModeChange,
  onSave,
  onPublish,
}: {
  title: string;
  blocks: PageBlock[];
  selectedId: string | null;
  previewMode: 'desktop' | 'mobile';
  dirty: boolean;
  saving: boolean;
  publishing: boolean;
  onTitleChange: (title: string) => void;
  onBlocksChange: (blocks: PageBlock[]) => void;
  onSelect: (id: string | null) => void;
  onPreviewModeChange: (mode: 'desktop' | 'mobile') => void;
  onSave: () => void;
  onPublish: () => void;
}) {
  const selected = blocks.find((block) => block.id === selectedId) ?? null;

  function addBlock(type: PageBlockType) {
    const next = [...blocks, createBlock(type)];
    onBlocksChange(next);
    onSelect(next[next.length - 1]!.id);
  }

  function duplicateSelected() {
    if (!selected) return;
    const clone = structuredClone(selected);
    clone.id = crypto.randomUUID();
    const index = blocks.findIndex((block) => block.id === selected.id);
    const next = [...blocks];
    next.splice(index + 1, 0, clone);
    onBlocksChange(next);
    onSelect(clone.id);
  }

  function removeSelected() {
    if (!selected) return;
    onBlocksChange(blocks.filter((block) => block.id !== selected.id));
    onSelect(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Input label="Título da página" value={title} onChange={(event) => onTitleChange(event.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={previewMode === 'desktop' ? 'primary' : 'secondary'}
            onClick={() => onPreviewModeChange('desktop')}
          >
            Desktop
          </Button>
          <Button
            type="button"
            variant={previewMode === 'mobile' ? 'primary' : 'secondary'}
            onClick={() => onPreviewModeChange('mobile')}
          >
            Mobile
          </Button>
          <Button type="button" variant="secondary" loading={saving} disabled={!dirty} onClick={onSave}>
            Salvar rascunho{dirty ? ' *' : ''}
          </Button>
          <Button type="button" loading={publishing} onClick={onPublish}>
            Publicar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)_280px]">
        <aside className="rounded-control border border-zinc-800 p-3" aria-label="Biblioteca de blocos">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Blocos</p>
          <ul className="space-y-1">
            {BLOCK_LIBRARY.map((item) => (
              <li key={item.type}>
                <button
                  type="button"
                  className="flex w-full min-h-11 items-center gap-2 rounded-control px-3 text-left text-sm text-zinc-300 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
                  onClick={() => addBlock(item.type)}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!selected}
              aria-label="Mover bloco para cima"
              onClick={() => selected && onBlocksChange(moveBlock(blocks, selected.id, -1))}
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
              Cima
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!selected}
              aria-label="Mover bloco para baixo"
              onClick={() => selected && onBlocksChange(moveBlock(blocks, selected.id, 1))}
            >
              <ArrowDown className="h-4 w-4" aria-hidden />
              Baixo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!selected}
              aria-label="Duplicar bloco"
              onClick={duplicateSelected}
            >
              <Copy className="h-4 w-4" aria-hidden />
              Duplicar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!selected}
              aria-label="Remover bloco"
              onClick={removeSelected}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Remover
            </Button>
          </div>

          <div
            className={cn(
              'mx-auto rounded-control border border-zinc-800 bg-zinc-950 p-4',
              previewMode === 'mobile' ? 'max-w-sm' : 'max-w-3xl',
            )}
          >
            <ul className="mb-4 space-y-2" aria-label="Ordem dos blocos">
              {blocks.map((block, index) => (
                <li key={block.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full min-h-11 items-center justify-between rounded-control border px-3 text-left text-sm',
                      selectedId === block.id
                        ? 'border-brand-500 bg-brand-500/10 text-brand-100'
                        : 'border-zinc-800 text-zinc-300 hover:bg-zinc-900',
                    )}
                    onClick={() => onSelect(block.id)}
                  >
                    <span>
                      {index + 1}. {block.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <PageBlocksRenderer blocks={blocks} />
          </div>
        </div>

        <aside className="rounded-control border border-zinc-800 p-3" aria-label="Propriedades do bloco">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Propriedades</p>
          {!selected ? (
            <p className="text-sm text-zinc-500">Selecione um bloco para editar.</p>
          ) : (
            <BlockProperties
              block={selected}
              onChange={(nextBlock) =>
                onBlocksChange(blocks.map((block) => (block.id === nextBlock.id ? nextBlock : block)))
              }
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function BlockProperties({
  block,
  onChange,
}: {
  block: PageBlock;
  onChange: (block: PageBlock) => void;
}) {
  if (block.type === 'hero') {
    return (
      <div className="space-y-3">
        <Input
          label="Headline"
          value={block.headline}
          onChange={(event) => onChange({ ...block, headline: event.target.value })}
        />
        <Input
          label="Subheadline"
          value={block.subheadline ?? ''}
          onChange={(event) => onChange({ ...block, subheadline: event.target.value })}
        />
        <Input
          label="Label do CTA"
          value={block.ctaLabel ?? ''}
          onChange={(event) => onChange({ ...block, ctaLabel: event.target.value })}
        />
      </div>
    );
  }

  if (block.type === 'rich_text') {
    return (
      <div className="space-y-3">
        <Input
          label="Título"
          value={block.title ?? ''}
          onChange={(event) => onChange({ ...block, title: event.target.value })}
        />
        <label className="block text-sm text-zinc-400">
          Texto
          <textarea
            className="mt-1 w-full rounded-control border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            rows={6}
            value={block.body}
            onChange={(event) => onChange({ ...block, body: event.target.value })}
          />
        </label>
      </div>
    );
  }

  if (block.type === 'cta_button') {
    return (
      <div className="space-y-3">
        <Input
          label="Label"
          value={block.label}
          onChange={(event) => onChange({ ...block, label: event.target.value })}
        />
        {block.action.type === 'external_url' || block.action.type === 'calendar' ? (
          <Input
            label="URL HTTPS"
            value={block.action.url}
            onChange={(event) =>
              onChange({
                ...block,
                action: { ...block.action, type: block.action.type, url: event.target.value },
              })
            }
          />
        ) : null}
        {block.action.type === 'whatsapp' || block.action.type === 'call' ? (
          <Input
            label="Telefone"
            value={block.action.phone}
            onChange={(event) =>
              onChange({
                ...block,
                action: { ...block.action, phone: event.target.value },
              })
            }
          />
        ) : null}
      </div>
    );
  }

  if (block.type === 'service_card') {
    return (
      <div className="space-y-3">
        <Input
          label="Título"
          value={block.title}
          onChange={(event) => onChange({ ...block, title: event.target.value })}
        />
        <label className="block text-sm text-zinc-400">
          Descrição
          <textarea
            className="mt-1 w-full rounded-control border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            rows={4}
            value={block.description}
            onChange={(event) => onChange({ ...block, description: event.target.value })}
          />
        </label>
      </div>
    );
  }

  if (block.type === 'contact_form') {
    return (
      <div className="space-y-3">
        <Input
          label="Título"
          value={block.title ?? ''}
          onChange={(event) => onChange({ ...block, title: event.target.value })}
        />
        <Input
          label="Label do botão"
          value={block.submitLabel}
          onChange={(event) => onChange({ ...block, submitLabel: event.target.value })}
        />
        <label className="block text-sm text-zinc-400">
          Aviso de privacidade
          <textarea
            className="mt-1 w-full rounded-control border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            rows={3}
            value={block.privacyNotice}
            onChange={(event) => onChange({ ...block, privacyNotice: event.target.value })}
          />
        </label>
      </div>
    );
  }

  if (block.type === 'map_address') {
    return (
      <Input
        label="Endereço"
        value={block.address}
        onChange={(event) => onChange({ ...block, address: event.target.value })}
      />
    );
  }

  if (block.type === 'footer') {
    return (
      <Input
        label="Texto"
        value={block.text ?? ''}
        onChange={(event) => onChange({ ...block, text: event.target.value })}
      />
    );
  }

  return <p className="text-sm text-zinc-500">Edição básica disponível para este bloco no MVP.</p>;
}
