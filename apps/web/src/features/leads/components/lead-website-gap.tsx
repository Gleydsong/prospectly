import { Globe, Plus, Search } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sanitizeExternalUrl } from '@/lib/safe-url';

export function LeadWebsiteGap({
  companyName,
  city,
  googleHref,
  pending,
  onSaveUrl,
}: {
  companyName: string;
  city?: string | null;
  googleHref: string | null;
  pending?: boolean;
  onSaveUrl: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-control border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
      <p className="text-sm font-medium text-[color:var(--ink)]">Oportunidade de presença online</p>
      <p className="mt-1 text-xs leading-relaxed text-[color:var(--ink-muted)]">
        Sem site cadastrado — argumento comercial para ofertar cardápio digital ou presença online
        {city ? ` em ${city}` : ''}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {googleHref ? (
          <a
            href={googleHref}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-8 items-center gap-1.5 rounded-control border border-[color:var(--border)] px-2.5 text-xs font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface-hover)]"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            Buscar no Google
          </a>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Inserir URL
        </Button>
      </div>
      {open ? (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const href = sanitizeExternalUrl(draft);
            if (!href) {
              setError('Informe uma URL http(s) válida.');
              return;
            }
            setError(null);
            onSaveUrl(href);
            setOpen(false);
            setDraft('');
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`site da ${companyName}`}
            aria-label="URL do site"
            leadingIcon={<Globe className="h-4 w-4" />}
          />
          <Button type="submit" size="sm" loading={pending}>
            Salvar
          </Button>
        </form>
      ) : null}
      {error ? (
        <p className="mt-1 text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
