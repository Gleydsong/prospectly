import { LeadStatus } from '@/types';
import { getLeadStatusMeta } from '@/lib/lead-status';

import { Badge } from './badge';

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const entry = getLeadStatusMeta(status);
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
