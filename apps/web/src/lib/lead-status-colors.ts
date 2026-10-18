import { LeadStatus } from '@/types';

// ID-01: one palette for pills and map pins. Dark pills composite over #172237.
function statusColors(pin: string, background: string, ink: string, darkInk: string) {
  return {
    light: { pin, background, ink },
    dark: { pin, background: `${pin}29`, ink: darkInk }, // 16% opacity
  };
}

export const LEAD_STATUS_COLORS = {
  NEW: statusColors('#2563eb', '#e6efff', '#1d4ed8', '#93bfff'),
  TO_REVIEW: statusColors('#d97706', '#fef3c7', '#92400e', '#fcd34d'),
  QUALIFIED: statusColors('#7c3aed', '#ede9fe', '#5b21b6', '#c4b5fd'),
  DISQUALIFIED: statusColors('#e11d48', '#ffe4e6', '#9f1239', '#fda4af'),
  CONTACTED: statusColors('#0284c7', '#e0f2fe', '#075985', '#7dd3fc'),
  RESPONDED: statusColors('#0d9488', '#ccfbf1', '#115e59', '#5eead4'),
  MEETING_SCHEDULED: statusColors('#4f46e5', '#e0e7ff', '#3730a3', '#c7d2fe'),
  PROPOSAL_SENT: statusColors('#ca8a04', '#fef9c3', '#854d0e', '#fde047'),
  NEGOTIATION: statusColors('#ea580c', '#ffedd5', '#9a3412', '#fdba74'),
  WON: statusColors('#16a34a', '#dcfce7', '#166534', '#86efac'),
  LOST: statusColors('#dc2626', '#fee2e2', '#991b1b', '#fca5a5'),
  ARCHIVED: statusColors('#64748b', '#e2e8f0', '#334155', '#cbd5e1'),
} satisfies Record<LeadStatus, ReturnType<typeof statusColors>>;

export function getLeadStatusStyle(status: LeadStatus) {
  return {
    backgroundColor: `var(--lead-status-${status}-background)`,
    color: `var(--lead-status-${status}-ink)`,
  };
}
