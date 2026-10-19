import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Tag } from '@/types';

export function LeadTagManager({
  tags,
  pending,
  onAdd,
  onRemove,
}: {
  tags: Tag[];
  pending?: boolean;
  onAdd: (name: string) => void;
  onRemove: (tagId: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  const submit = () => {
    const name = draft.trim();
    if (!name) return;
    onAdd(name);
    setDraft('');
  };

  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase text-[color:var(--ink-muted)]">
        {t('clientFile.tags')}
      </p>
      <div className="flex flex-wrap gap-1">
        {tags.length === 0 ? (
          <span className="text-sm text-[color:var(--ink-muted)]">{t('clientFile.noTags')}</span>
        ) : (
          tags.map((tag) => (
            <Badge key={tag.id} className="pr-1">
              {tag.name}
              <button
                type="button"
                className="ml-0.5 rounded-full p-0.5 hover:bg-[color:var(--surface-hover)]"
                aria-label={t('clientFile.removeTag', { name: tag.name })}
                disabled={pending}
                onClick={() => onRemove(tag.id)}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ))
        )}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('clientFile.newTag')}
          aria-label={t('clientFile.newTag')}
          className="h-8"
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending || !draft.trim()}>
          {t('clientFile.add')}
        </Button>
      </form>
    </div>
  );
}
