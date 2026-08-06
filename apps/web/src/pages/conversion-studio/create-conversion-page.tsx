import { ArrowUpRight, FileText, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCreateConversionPage, useEntitlements } from '@/features/conversion-studio/hooks';
import { fetchLead, fetchLeads } from '@/features/leads/api';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

type TemplateId = 'proposta' | 'proposta_form' | 'blank';

type CreatePhase = 'idle' | 'creating';

const TEMPLATES: Array<{ id: TemplateId; label: string; hint: string }> = [
  {
    id: 'proposta',
    label: 'Proposta padrão',
    hint: 'Hero, serviço, formulário e rodapé',
  },
  {
    id: 'proposta_form',
    label: 'Proposta + contacto',
    hint: 'Foco em conversão com formulário',
  },
  {
    id: 'blank',
    label: 'Em branco',
    hint: 'Só o essencial — você monta no editor',
  },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function CreateConversionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedLeadId = searchParams.get('leadId');
  const entitlements = useEntitlements();
  const createPage = useCreateConversionPage();

  const [leadQuery, setLeadQuery] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<{
    id: string;
    companyName: string;
    city?: string | null;
    category?: string | null;
  } | null>(null);
  const [templateId, setTemplateId] = useState<TemplateId>('proposta');
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<CreatePhase>('idle');

  const busy = phase === 'creating';

  const draftsBlocked = Boolean(
    entitlements.data &&
      entitlements.data.usage.pageDrafts >= entitlements.data.limits.pageDrafts,
  );

  const preselectedLead = useQuery({
    queryKey: ['leads', preselectedLeadId],
    queryFn: () => fetchLead(preselectedLeadId!),
    enabled: Boolean(preselectedLeadId),
  });

  useEffect(() => {
    if (!preselectedLead.data) return;
    setSelectedLead({
      id: preselectedLead.data.id,
      companyName: preselectedLead.data.companyName,
      city: preselectedLead.data.city,
      category: preselectedLead.data.category,
    });
  }, [preselectedLead.data]);

  const leadsPicker = useQuery({
    queryKey: ['conversion-pages', 'create-lead-picker', leadSearch],
    queryFn: () =>
      fetchLeads({
        page: 1,
        pageSize: 10,
        q: leadSearch || undefined,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      }),
    enabled: !selectedLead && !busy,
  });

  useEffect(() => {
    if (busy) return;
    const timer = window.setTimeout(() => setLeadSearch(leadQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [leadQuery, busy]);

  const canCreate = useMemo(() => {
    if (draftsBlocked || busy || createPage.isPending) return false;
    return Boolean(selectedLead);
  }, [busy, createPage.isPending, draftsBlocked, selectedLead]);

  async function handleCreate() {
    if (!canCreate || !selectedLead) return;
    setError(null);
    setPhase('creating');

    try {
      const page = await createPage.mutateAsync({
        title: selectedLead.companyName,
        leadId: selectedLead.id,
      });
      navigate(`/pages/${page.id}/edit`, { replace: true });
    } catch (err) {
      setPhase('idle');
      setError(getApiErrorMessage(err) ?? 'Não foi possível criar a página.');
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-xl flex-col justify-center px-1 py-6">
      <div className="mb-8 text-center" aria-live="polite">
        {phase === 'creating' ? (
          <CreatingState />
        ) : (
          <>
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-brand-300 shadow-soft"
              aria-hidden
            >
              <FileText className="h-5 w-5" />
            </div>
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              Criar página de proposta
            </h1>
            <p className="mx-auto mt-2 max-w-md text-pretty text-sm text-zinc-400">
              Escolha o lead e monte o rascunho a partir do modelo. Depois edite os blocos e publique
              quando estiver pronto.
            </p>
          </>
        )}
      </div>

      <div
        className={cn(
          'rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-soft sm:p-5',
          busy && 'pointer-events-none',
        )}
      >
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-200">
          <Users className="h-4 w-4 text-brand-300" aria-hidden />
          Lead existente
        </div>

        <div className="space-y-3">
          {!selectedLead ? (
            <Input
              label="Buscar lead"
              placeholder="Buscar lead por nome ou cidade…"
              value={leadQuery}
              onChange={(event) => setLeadQuery(event.target.value)}
            />
          ) : null}

          {selectedLead ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-control border border-brand-500/30 bg-brand-500/10 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <AvatarMark name={selectedLead.companyName} active />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-50">
                      {selectedLead.companyName}
                    </p>
                    <p className="truncate text-xs text-zinc-400">
                      {[selectedLead.category, selectedLead.city].filter(Boolean).join(' · ') ||
                        'Lead selecionado'}
                    </p>
                  </div>
                </div>
                {!busy ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedLead(null)}
                  >
                    Trocar
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-zinc-500">
                O rascunho usa nome, categoria, cidade e contacto deste lead. Você ajusta tudo no
                editor.
              </p>
            </div>
          ) : leadsPicker.isLoading ? (
            <Skeleton className="h-36" />
          ) : (leadsPicker.data?.data ?? []).length === 0 ? (
            <div className="rounded-control border border-dashed border-zinc-700 bg-zinc-950/50 px-4 py-8 text-center">
              <p className="text-sm text-zinc-300">Nenhum lead encontrado</p>
              <p className="mt-1 text-xs text-zinc-500">
                Importe do CRM ou{' '}
                <Link to="/search" className="text-brand-300 hover:underline">
                  faça uma pesquisa
                </Link>
                .
              </p>
            </div>
          ) : (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto" role="listbox" aria-label="Leads">
              {(leadsPicker.data?.data ?? []).map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="flex w-full min-h-12 items-center gap-3 rounded-control border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900"
                    onClick={() =>
                      setSelectedLead({
                        id: lead.id,
                        companyName: lead.companyName,
                        city: lead.city,
                        category: lead.category,
                      })
                    }
                  >
                    <AvatarMark name={lead.companyName} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-100">
                        {lead.companyName}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        {[lead.category, lead.city].filter(Boolean).join(' · ') || 'Sem cidade'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error ? (
          <p className="mt-4 rounded-control bg-red-500/10 p-3 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <Select
              label="Modelo"
              value={templateId}
              disabled={busy}
              onChange={(event) => setTemplateId(event.target.value as TemplateId)}
            >
              {TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-xs text-zinc-500">
              {phase === 'creating'
                ? 'Criando o projeto…'
                : (TEMPLATES.find((template) => template.id === templateId)?.hint ??
                  'Escolha um modelo pra começar')}
            </p>
          </div>

          <div className="pointer-events-auto flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => navigate('/pages')}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={!canCreate} onClick={() => void handleCreate()}>
              {busy ? 'Criando…' : 'Criar rascunho'}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>

        {draftsBlocked && !busy ? (
          <p className="mt-3 text-xs text-amber-200/90">
            Limite de rascunhos do plano atingido.{' '}
            <Link to="/settings" className="text-brand-300 hover:underline">
              Ver planos
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CreatingState() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex h-28 w-28 items-center justify-center">
        <span
          className="absolute inset-0 rounded-full bg-brand-500/25 blur-2xl animate-pulse"
          aria-hidden
        />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b from-brand-400 to-brand-700 text-sm font-semibold text-white shadow-[0_0_40px_rgba(59,130,246,0.45)] ring-1 ring-brand-300/40">
          Criando
        </span>
      </div>
      <p className="text-sm text-zinc-400">Montando o rascunho a partir do lead…</p>
    </div>
  );
}

function AvatarMark({ name, active }: { name: string; active?: boolean }) {
  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        active ? 'bg-brand-500/20 text-brand-200' : 'bg-zinc-800 text-zinc-300',
      )}
      aria-hidden
    >
      {initials(name) || '?'}
    </span>
  );
}
