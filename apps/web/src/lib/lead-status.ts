import { LeadStatus } from '@/types';
import i18n from '@/i18n';

export type StatusTone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'brand' | 'purple';

const STATUS_TONES: Record<LeadStatus, StatusTone> = {
  NEW: 'brand',
  TO_REVIEW: 'blue',
  QUALIFIED: 'green',
  DISQUALIFIED: 'slate',
  CONTACTED: 'amber',
  RESPONDED: 'amber',
  MEETING_SCHEDULED: 'purple',
  PROPOSAL_SENT: 'purple',
  NEGOTIATION: 'purple',
  WON: 'green',
  LOST: 'red',
  ARCHIVED: 'slate',
};

export function getLeadStatusMeta(status: LeadStatus) {
  return {
    label: i18n.t(`status.${status}`, { defaultValue: String(status) }),
    shortLabel: i18n.t(`statusShort.${status}`, { defaultValue: String(status) }),
    tone: STATUS_TONES[status] ?? ('slate' as const),
  };
}

export function getLeadStatusLabel(status: LeadStatus): string {
  return getLeadStatusMeta(status).label;
}

export function getLeadStatusShortLabel(status: LeadStatus): string {
  return getLeadStatusMeta(status).shortLabel;
}
