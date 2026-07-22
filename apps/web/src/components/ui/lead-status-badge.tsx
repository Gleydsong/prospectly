import { LeadStatus } from '@/types';

import { Badge } from './badge';

const STATUS_MAP: Record<LeadStatus, { label: string; tone: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'brand' | 'purple' }> = {
  NEW: { label: 'Novo', tone: 'brand' },
  TO_REVIEW: { label: 'Em análise', tone: 'blue' },
  QUALIFIED: { label: 'Qualificado', tone: 'green' },
  DISQUALIFIED: { label: 'Desqualificado', tone: 'slate' },
  CONTACTED: { label: 'Contatado', tone: 'amber' },
  RESPONDED: { label: 'Respondeu', tone: 'amber' },
  MEETING_SCHEDULED: { label: 'Reunião marcada', tone: 'purple' },
  PROPOSAL_SENT: { label: 'Proposta enviada', tone: 'purple' },
  NEGOTIATION: { label: 'Negociação', tone: 'purple' },
  WON: { label: 'Ganho', tone: 'green' },
  LOST: { label: 'Perdido', tone: 'red' },
  ARCHIVED: { label: 'Arquivado', tone: 'slate' },
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const entry = STATUS_MAP[status] ?? { label: status, tone: 'slate' as const };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
