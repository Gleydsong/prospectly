import { ArrowUpRight, Link2, Sparkles, Users, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useEntitlements, useGenerateLandingPage } from '@/features/conversion-studio/hooks';
import { getConversionPage } from '@/features/conversion-studio/services/api';
import { fetchLead, fetchLeads } from '@/features/leads/api';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

type CreateTab = 'describe' | 'google' | 'lead';

type TemplateId = 'proposta' | 'proposta_form' | 'blank';

type GeneratePhase = 'idle' | 'creating';

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

const CREATE_MIN_MS = 900;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function CreateConversionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedLeadId = searchParams.get('leadId');
  const entitlements = useEntitlements();
  const generatePage = useGenerateLandingPage();

  const [tab, setTab] = useState<CreateTab>('lead');
  const [leadQuery, setLeadQuery] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<{
    id: string;
    companyName: string;
    city?: string | null;
    category?: string | null;
  } | null>(null);
  const [templateId, setTemplateId] = useState<TemplateId>('proposta');
  const [describeText, setDescribeText] = useState('');
  const [googleLink, setGoogleLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<GeneratePhase>('idle');

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
    setTab('lead');
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
    enabled: tab === 'lead' && !selectedLead && !busy,
  });

  useEffect(() => {
    if (tab !== 'lead' || busy) return;
    const timer = window.setTimeout(() => setLeadSearch(leadQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [leadQuery, tab, busy]);

  const aiRemaining = entitlements.data
    ? Math.max(0, entitlements.data.limits.aiGenerations - entitlements.data.usage.aiGenerations)
    : null;

  const canGenerate = useMemo(() => {
    if (draftsBlocked || busy || generatePage.isPending) return false;
    if (tab === 'lead') return Boolean(selectedLead);
    if (tab === 'describe') return describeText.trim().length >= 12;
    if (tab === 'google') {
      try {
        const url = new URL(googleLink.trim());
        return ['http:', 'https:'].includes(url.protocol) && googleLink.trim().length > 12;
      } catch {
        return false;
      }
    }
    return false;
  }, [
    busy,
    describeText,
    draftsBlocked,
    generatePage.isPending,
    googleLink,
    selectedLead,
    tab,
  ]);

  async function pollUntilReady(pageId: string) {
    const started = Date.now();
    while (Date.now() - started < 120_000) {
      const current = await getConversionPage(pageId);
      if (current.generationStatus === 'SUCCEEDED') {
        navigate(`/pages/${pageId}/view`, { replace: true });
        return;
      }
      if (current.generationStatus === 'FAILED') {
        throw new Error(current.generationError || 'Falha ao gerar a página.');
      }
      await wait(CREATE_MIN_MS);
    }
    navigate(`/pages/${pageId}/view`, { replace: true });
  }

  async function handleGenerate() {
    if (!canGenerate) return;
    setError(null);
    setPhase('creating');

    try {
      const page =
        tab === 'lead' && selectedLead
          ? await generatePage.mutateAsync({
              title: selectedLead.companyName,
              leadId: selectedLead.id,
            })
          : tab === 'describe'
            ? await generatePage.mutateAsync({
                describeText: describeText.trim(),
                title: describeText.trim().split('\n')[0]?.slice(0, 80),
              })
            : await generatePage.mutateAsync({
                googleLink: googleLink.trim(),
              });

      await pollUntilReady(page.id);
    } catch (err) {
      setPhase('idle');
      setError(getApiErrorMessage(err) ?? 'Não foi possível gerar a página.');
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-xl flex-col justify-center px-1 py-6">
      <div className="mb-8 text-center" aria-live="polite">
        {phase === 'creating' ? (
          <CreatingOrb />
        ) : (
          <>
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-brand-300 shadow-soft"
              aria-hidden
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              Criar site do lead
            </h1>
            <p className="mx-auto mt-2 max-w-md text-pretty text-sm text-zinc-400">
              Escolha o lead da prospeção. O React Aura monta a landing completa com os dados
              dele — você só publica e envia ao cliente.
            </p>
            {aiRemaining != null ? (
              <p className="mt-2 text-xs text-zinc-500">
                Gerações React Aura restantes neste plano: {aiRemaining}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div
        className={cn(
          'rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-soft sm:p-5',
          busy && 'pointer-events-none',
        )}
      >
        <div
          className="grid grid-cols-3 gap-1 rounded-control bg-zinc-950/80 p-1"
          role="tablist"
          aria-label="Origem da página"
        >
          <TabButton
            active={tab === 'lead'}
            disabled={busy}
            icon={<Users className="h-3.5 w-3.5" aria-hidden />}
            label="Lead existente"
            onClick={() => setTab('lead')}
          />
          <TabButton
            active={tab === 'describe'}
            disabled={busy}
            icon={<Wand2 className="h-3.5 w-3.5" aria-hidden />}
            label="Descrever"
            onClick={() => setTab('describe')}
          />
          <TabButton
            active={tab === 'google'}
            disabled={busy}
            icon={<Link2 className="h-3.5 w-3.5" aria-hidden />}
            label="Link do Google"
            onClick={() => setTab('google')}
          />
        </div>

        <div className="mt-4 space-y-4" role="tabpanel">
          {tab === 'describe' ? (
            <label className="block text-sm text-zinc-400">
              Descrição do negócio
              <textarea
                className="mt-1.5 w-full rounded-control border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
                rows={5}
                placeholder="Ex.: Barbearia em Olinda (Casa Caiada), cortes clássicos, barba e atendimento personalizado. WhatsApp principal para agendar."
                value={describeText}
                onChange={(event) => setDescribeText(event.target.value)}
                disabled={busy}
              />
              <span className="mt-1.5 block text-xs text-zinc-500">
                Mínimo 12 caracteres. Consome 1 geração de IA.
              </span>
            </label>
          ) : null}

          {tab === 'google' ? (
            <div className="space-y-2">
              <Input
                label="Link do Google"
                placeholder="https://maps.google.com/… ou https://maps.app.goo.gl/…"
                value={googleLink}
                onChange={(event) => setGoogleLink(event.target.value)}
                disabled={busy}
              />
              <p className="text-xs text-zinc-500">
                Aceita Maps/Business. Se o lugar já existir no CRM, vinculamos o lead
                automaticamente.
              </p>
            </div>
          ) : null}

          {tab === 'lead' ? (
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
                    Ao gerar, o React Aura usa nome, categoria, cidade e contacto deste lead para montar o
                    site dentro da Prospectly.
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
          ) : null}
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
            <Button type="button" disabled={!canGenerate} onClick={() => void handleGenerate()}>
              {busy ? 'Gerando…' : tab === 'lead' ? 'Gerar site do lead' : 'Gerar'}
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

function CreatingOrb() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex h-28 w-28 items-center justify-center">
        <span
          className="absolute inset-0 rounded-full bg-brand-500/25 blur-2xl animate-pulse"
          aria-hidden
        />
        <span
          className="absolute inset-3 rounded-full bg-brand-500/20 blur-md animate-pulse"
          aria-hidden
        />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b from-brand-400 to-brand-700 text-sm font-semibold text-white shadow-[0_0_40px_rgba(59,130,246,0.45)] ring-1 ring-brand-300/40">
          Criando
        </span>
      </div>
      <p className="text-sm text-zinc-400">O React Aura está montando o site do lead…</p>
    </div>
  );
}

function TabButton({
  active,
  disabled,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'relative flex min-h-10 items-center justify-center gap-1.5 rounded-control px-2 text-xs font-medium transition-colors sm:text-sm',
        active
          ? 'cta-glass !shadow-none text-white'
          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200',
        disabled && 'cursor-not-allowed opacity-70',
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
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
