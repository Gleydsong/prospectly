import { LeadStatus } from '@/types';
import { LEAD_STATUS_COLORS } from './lead-status-colors';
import i18n from '@/i18n';

export function getLeadStatusMeta(status: LeadStatus) {
  return {
    colors: LEAD_STATUS_COLORS[status],
    label: i18n.t(`status.${status}`, { defaultValue: String(status) }),
    shortLabel: i18n.t(`statusShort.${status}`, { defaultValue: String(status) }),
  };
}

export function getLeadStatusLabel(status: LeadStatus): string {
  return getLeadStatusMeta(status).label;
}

export function getLeadStatusShortLabel(status: LeadStatus): string {
  return getLeadStatusMeta(status).shortLabel;
}
