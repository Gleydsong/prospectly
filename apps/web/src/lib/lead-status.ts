import { LeadStatus } from '@/types';

export type StatusTone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'brand' | 'purple';

const STATUS_META: Record<LeadStatus, { label: string; shortLabel: string; tone: StatusTone }> = {
  NEW: { label: 'Novo', shortLabel: 'Novo', tone: 'brand' },
  TO_REVIEW: { label: 'Em análise', shortLabel: 'Análise', tone: 'blue' },
  QUALIFIED: { label: 'Qualificado', shortLabel: 'Qualif.', tone: 'green' },
  DISQUALIFIED: { label: 'Desqualificado', shortLabel: 'Desqual.', tone: 'slate' },
  CONTACTED: { label: 'Contatado', shortLabel: 'Contato', tone: 'amber' },
  RESPONDED: { label: 'Respondeu', shortLabel: 'Resp.', tone: 'amber' },
  MEETING_SCHEDULED: { label: 'Reunião marcada', shortLabel: 'Reunião', tone: 'purple' },
  PROPOSAL_SENT: { label: 'Proposta enviada', shortLabel: 'Proposta', tone: 'purple' },
  NEGOTIATION: { label: 'Negociação', shortLabel: 'Negoc.', tone: 'purple' },
  WON: { label: 'Ganho', shortLabel: 'Ganho', tone: 'green' },
  LOST: { label: 'Perdido', shortLabel: 'Perdido', tone: 'red' },
  ARCHIVED: { label: 'Arquivado', shortLabel: 'Arquiv.', tone: 'slate' },
};

export function getLeadStatusMeta(status: LeadStatus) {
  return STATUS_META[status] ?? { label: String(status), shortLabel: String(status), tone: 'slate' as const };
}

export function getLeadStatusLabel(status: LeadStatus): string {
  return getLeadStatusMeta(status).label;
}

export function getLeadStatusShortLabel(status: LeadStatus): string {
  return getLeadStatusMeta(status).shortLabel;
}
