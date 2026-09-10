import { Globe, Plus, Search } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sanitizeExternalUrl } from '@/lib/safe-url';

export function resolveWebsitePitch(
  category?: string | null,
  segment?: string | null,
  city?: string | null,
): string {
  const norm = `${category ?? ''} ${segment ?? ''}`.toLowerCase();
  const citySuffix = city?.trim() ? ` em ${city.trim()}` : '';

  if (
    norm.includes('restaurant') ||
    norm.includes('bar') ||
    norm.includes('cafe') ||
    norm.includes('bakery') ||
    norm.includes('lanche') ||
    norm.includes('pizza') ||
    norm.includes('comida') ||
    norm.includes('gastronom')
  ) {
    return `Sem site cadastrado — argumento comercial para ofertar cardápio digital ou pedidos online${citySuffix}.`;
  }

  if (
    norm.includes('hairdresser') ||
    norm.includes('beauty') ||
    norm.includes('salon') ||
    norm.includes('salão') ||
    norm.includes('cabeleireiro') ||
    norm.includes('barbearia') ||
    norm.includes('estetica') ||
    norm.includes('estética') ||
    norm.includes('dentist') ||
    norm.includes('physio') ||
    norm.includes('clinica') ||
    norm.includes('clínica') ||
    norm.includes('veterin') ||
    norm.includes('spa') ||
    norm.includes('gym') ||
    norm.includes('academia')
  ) {
    return `Sem site cadastrado — argumento comercial para ofertar agendamento online ou catálogo de serviços${citySuffix}.`;
  }

  if (norm.includes('hotel') || norm.includes('hostel') || norm.includes('pousada')) {
    return `Sem site cadastrado — argumento comercial para ofertar reservas diretas e presença online${citySuffix}.`;
  }

  return `Sem site cadastrado — argumento comercial para ofertar presença online no Google ou site institucional${citySuffix}.`;
}

export function LeadWebsiteGap({
  companyName,
  city,
  category,
  segment,
  googleHref,
  pending,
  onSaveUrl,
}: {
  companyName: string;
  city?: string | null;
  category?: string | null;
  segment?: string | null;
  googleHref: string | null;
  pending?: boolean;
  onSaveUrl: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pitch = resolveWebsitePitch(category, segment, city);

  return (
    <div className="rounded-control border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3">
      <p className="text-sm font-medium text-[color:var(--ink)]">Oportunidade de presença online</p>
      <p className="mt-1 text-xs leading-relaxed text-[color:var(--ink-muted)]">
        {pitch}
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
