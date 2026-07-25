import { useTranslation } from 'react-i18next';

import { LeadStatus } from '@/types';
import { getLeadStatusMeta } from '@/lib/lead-status';

import { Badge } from './badge';

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const { i18n } = useTranslation();
  const entry = getLeadStatusMeta(status);
  return (
    <Badge key={i18n.language} tone={entry.tone}>
      {entry.label}
    </Badge>
  );
}
