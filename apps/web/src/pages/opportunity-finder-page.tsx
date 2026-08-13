import { useMemo, useState } from 'react';
import { ArrowLeft, BrainCircuit, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { OpportunityCandidateCard } from '@/features/opportunity-finder/opportunity-candidate-card';
import { OpportunityCandidateModal } from '@/features/opportunity-finder/opportunity-candidate-modal';
import {
  useCreateOpportunityRun,
  useExplainOpportunityCandidate,
  useOpportunityCandidates,
  useOpportunityRun,
  useSaveOpportunityAsLead,
} from '@/features/opportunity-finder/hooks';
import { useGeoCities, useGeoRegions } from '@/features/prospecting/hooks';
import { getApiErrorMessage } from '@/lib/api';
import { CREDIT_COSTS, type OpportunityCandidateView } from '@/types';

const activeStatuses = new Set(['PREPARING', 'SEARCHING', 'ANALYZING', 'RANKING']);
const statusLabels: Record<string, string> = {
  PREPARING: 'Entendendo o serviço', SEARCHING: 'Buscando empresas', ANALYZING: 'Analisando evidências',
  RANKING: 'Ordenando oportunidades', COMPLETED: 'Análise concluída', PARTIAL: 'Análise parcial',
  FAILED: 'Não foi possível concluir', CANCELLED: 'Análise cancelada',
};

export function OpportunityFinderPage() {
  const [service, setService] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [runId, setRunId] = useState('');
  const [selected, setSelected] = useState<OpportunityCandidateView | null>(null);
  const [rankingFilter, setRankingFilter] = useState<'ALL' | OpportunityCandidateView['rankingCategory']>('ALL');
  const [error, setError] = useState<string | null>(null);
  const regionsQuery = useGeoRegions('BR');
  const citiesQuery = useGeoCities('BR', state || undefined);
  const createRun = useCreateOpportunityRun();
  const runQuery = useOpportunityRun(runId);
  const run = runQuery.data;
  const isRunning = Boolean(run && activeStatuses.has(run.status));
  const candidatesQuery = useOpportunityCandidates(runId, undefined, isRunning);
  const explain = useExplainOpportunityCandidate();
  const saveLead = useSaveOpportunityAsLead();
  const candidates = useMemo(() => candidatesQuery.data?.data ?? [], [candidatesQuery.data]);
  const visibleCandidates = rankingFilter === 'ALL'
    ? candidates
    : candidates.filter((candidate) => candidate.rankingCategory === rankingFilter);
  const categoryCounts = candidates.reduce<Record<string, number>>((counts, candidate) => {
    counts[candidate.rankingCategory] = (counts[candidate.rankingCategory] ?? 0) + 1;
    return counts;
  }, {});

  const start = async () => {
    if (!service.trim() || !state || !city) {
      setError('Informe o serviço, o estado e a cidade.');
      return;
    }
    setError(null);
    setSelected(null);
    try {
      const created = await createRun.mutateAsync({
        service: service.trim(), city, state, country: 'BR', idempotencyKey: crypto.randomUUID(),
      });
      setRunId(created.id);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  };

  const explainSelected = async () => {
    if (!selected) return;
    setError(null);
    try {
      const updated = await explain.mutateAsync({ runId: selected.runId, candidateId: selected.id });
      setSelected(updated);
    } catch (requestError) { setError(getApiErrorMessage(requestError)); }
  };

  const saveSelected = async () => {
    if (!selected) return;
    setError(null);
    try {
      const result = await saveLead.mutateAsync({ runId: selected.runId, candidateId: selected.id });
      setSelected({ ...selected, importedLeadId: result.leadId });
    } catch (requestError) { setError(getApiErrorMessage(requestError)); }
  };

  return (
    <div className="space-y-6">
      <Link to="/tools" className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--ink-muted)] hover:text-[color:var(--ink)]">
        <ArrowLeft className="h-4 w-4" /> Voltar para Ferramentas
      </Link>
      <PageHeader eyebrow="Inteligência comercial" title="AI Opportunity Finder" description="Descreva o que você vende. A Prospectly busca empresas brasileiras, verifica sinais públicos e prioriza oportunidades com evidências." />

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
            <Input id="opportunity-service" label="O que você vende?" placeholder="Ex.: criação de sites para clínicas" value={service} maxLength={240} onChange={(event) => setService(event.target.value)} />
            <Select id="opportunity-state" label="Estado" value={state} onChange={(event) => { setState(event.target.value); setCity(''); }} disabled={regionsQuery.isLoading}>
              <option value="">Selecione</option>
              {(regionsQuery.data ?? []).map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
            </Select>
            <Select id="opportunity-city" label="Cidade" value={city} onChange={(event) => setCity(event.target.value)} disabled={!state || citiesQuery.isLoading}>
              <option value="">Selecione</option>
              {(citiesQuery.data ?? []).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs text-[color:var(--ink-muted)]"><ShieldCheck className="h-4 w-4" />Busca limitada ao Brasil. Cada execução consome {CREDIT_COSTS.opportunityFinder} créditos após as buscas grátis.</p>
            <Button loading={createRun.isPending} disabled={isRunning} onClick={() => void start()}><Search className="h-4 w-4" />Encontrar oportunidades</Button>
          </div>
        </CardContent>
      </Card>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {run ? (
        <Alert tone={run.status === 'FAILED' ? 'error' : run.status === 'PARTIAL' ? 'warning' : 'info'} title={statusLabels[run.status] ?? run.status}>
          <div className="flex flex-wrap gap-3">
            <span>{run.analyzedCount} analisadas</span><span>{run.candidateCount} encontradas</span>
            {run.failedCount ? <span>{run.failedCount} falharam</span> : null}
          </div>
          {isRunning ? <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-full animate-pulse rounded-full bg-[color:var(--accent)]" /></div> : null}
        </Alert>
      ) : null}

      {run?.profile ? (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3"><BrainCircuit className="mt-0.5 h-5 w-5 text-[color:var(--accent)]" /><div><h2 className="font-bold text-[color:var(--ink)]">Perfil de oportunidade</h2><p className="mt-1 text-sm text-[color:var(--ink-muted)]">{run.profile.targetCustomer.join(' · ')}</p><div className="mt-3 flex flex-wrap gap-2">{run.profile.categories.map((category) => <Badge key={category} tone="blue">{category}</Badge>)}</div></div></div>
          </CardContent>
        </Card>
      ) : null}

      {candidates.length ? (
        <section className="space-y-3">
          <div><h2 className="text-lg font-bold text-[color:var(--ink)]">{candidates.length} oportunidades priorizadas</h2><p className="text-sm text-[color:var(--ink-muted)]">Ranking determinístico; a IA explica os dados, mas não define a pontuação.</p></div>
          <div className="flex flex-wrap gap-2" aria-label="Filtrar oportunidades por prioridade">
            {(['ALL', 'EXCELLENT', 'HIGH', 'MEDIUM', 'LOW'] as const).map((category) => (
              <Button key={category} size="sm" variant={rankingFilter === category ? 'primary' : 'secondary'} onClick={() => setRankingFilter(category)}>
                {category === 'ALL' ? `Todas (${candidates.length})` : `${category === 'EXCELLENT' ? 'Excelentes' : category === 'HIGH' ? 'Altas' : category === 'MEDIUM' ? 'Médias' : 'Baixas'} (${categoryCounts[category] ?? 0})`}
              </Button>
            ))}
          </div>
          {visibleCandidates.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleCandidates.map((candidate) => <OpportunityCandidateCard key={candidate.id} candidate={candidate} onOpen={setSelected} />)}</div> : <Alert>Nenhuma oportunidade corresponde a este filtro.</Alert>}
        </section>
      ) : run && !isRunning && run.status !== 'FAILED' ? <Alert title="Nenhuma oportunidade encontrada">Tente ajustar a descrição do serviço ou selecionar outra cidade brasileira.</Alert> : null}

      <OpportunityCandidateModal candidate={selected} open={Boolean(selected)} onClose={() => setSelected(null)} onExplain={() => void explainSelected()} onSave={() => void saveSelected()} explaining={explain.isPending} saving={saveLead.isPending} />
    </div>
  );
}
