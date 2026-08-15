import { CheckCircle2, CircleHelp, XCircle } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { CREDIT_COSTS, type OpportunityCandidateView } from '@/types';
import {
  formatEvidenceKind,
  formatEvidenceSource,
  formatOpportunityDimension,
} from './opportunity-labels';

const signalLabels: Record<string, string> = {
  MISSING_WEBSITE: 'Site não informado',
  LOW_PERFORMANCE: 'Desempenho baixo',
  MISSING_HTTPS: 'HTTPS ausente',
  MISSING_MOBILE_SUPPORT: 'Suporte móvel ausente',
  MISSING_BOOKING: 'Agendamento não detectado',
  MISSING_WHATSAPP: 'WhatsApp não detectado',
  MISSING_CONTACT_FORM: 'Formulário não detectado',
  HIGH_REVIEW_COUNT: 'Muitas avaliações',
  HIGH_RATING: 'Avaliação alta',
  CONTACT_AVAILABLE: 'Contato disponível',
  ACTIVE_BUSINESS: 'Empresa aparentemente ativa',
};

export function OpportunityCandidateModal({
  candidate,
  open,
  onClose,
  onExplain,
  onSave,
  explaining,
  saving,
}: {
  candidate: OpportunityCandidateView | null;
  open: boolean;
  onClose: () => void;
  onExplain: () => void;
  onSave: () => void;
  explaining: boolean;
  saving: boolean;
}) {
  if (!candidate) return null;
  const explanation = candidate.explanation;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={candidate.company.companyName}
      className="max-w-3xl"
    >
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-5">
          {Object.entries(candidate.scoreBreakdown.dna).map(([dimension, score]) => (
            <div
              key={dimension}
              className="rounded-control bg-[color:var(--surface-hover)] p-3 text-center"
            >
              <strong className="block text-lg text-[color:var(--ink)]">{score}</strong>
              <span className="text-xs text-[color:var(--ink-muted)]">
                {formatOpportunityDimension(dimension)}
              </span>
            </div>
          ))}
        </div>

        <section>
          <h3 className="mb-3 text-sm font-bold text-[color:var(--ink)]">Evidências verificadas</h3>
          <div className="space-y-2">
            {candidate.signals.map((signal) => {
              const Icon =
                signal.value === 'TRUE'
                  ? CheckCircle2
                  : signal.value === 'FALSE'
                    ? XCircle
                    : CircleHelp;
              return (
                <div
                  key={signal.type}
                  className="flex gap-3 rounded-control border border-[color:var(--border)] p-3"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--ink-muted)]" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-[color:var(--ink)]">
                        {signalLabels[signal.type] ?? 'Sinal de oportunidade'}
                      </strong>
                      <Badge
                        tone={
                          signal.kind === 'FACT'
                            ? 'green'
                            : signal.kind === 'UNKNOWN'
                              ? 'slate'
                              : 'amber'
                        }
                      >
                        {formatEvidenceKind(signal.kind)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-[color:var(--ink-muted)]">{signal.evidence}</p>
                    <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
                      Fonte: {formatEvidenceSource(signal.source)} · Confiança:{' '}
                      {Math.round(signal.confidence * 100)}% · Verificado:{' '}
                      {new Date(signal.checkedAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {explanation ? (
          <Alert tone="info" title="Leitura comercial assistida">
            <p>{explanation.summary}</p>
            <p className="mt-2">
              <strong>Por que pode ser oportunidade:</strong> {explanation.whyOpportunity}
            </p>
            <p className="mt-2">
              <strong>Oferta sugerida:</strong> {explanation.recommendedOffer}
            </p>
            <p className="mt-2">
              <strong>Abordagem:</strong> {explanation.commercialAngle}
            </p>
          </Alert>
        ) : null}

        <Alert tone="warning">
          Sinais negativos são hipóteses de prospecção, não fatos sobre a necessidade da empresa.
          Valide antes de contactar.
        </Alert>

        <div className="flex flex-wrap justify-end gap-2">
          {!explanation ? (
            <Button variant="secondary" loading={explaining} onClick={onExplain}>
              Gerar explicação ({CREDIT_COSTS.explain} créditos)
            </Button>
          ) : null}
          <Button loading={saving} disabled={Boolean(candidate.importedLeadId)} onClick={onSave}>
            {candidate.importedLeadId
              ? 'Salvo como cliente potencial'
              : `Salvar como cliente potencial (${CREDIT_COSTS.saveLead} crédito)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
