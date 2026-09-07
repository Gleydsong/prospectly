import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  ExternalLink,
  MessageCircle,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { CrmActionCode } from '@/features/agents/api';
import { useCrmApply, useCrmSuggest } from '@/features/agents/hooks';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface CrmCopilotCardProps {
  leadId: string;
  onOpenWhatsApp?: () => void;
  className?: string;
}

export function CrmCopilotCard({ leadId, onOpenWhatsApp, className }: CrmCopilotCardProps) {
  const { t } = useTranslation();
  const suggest = useCrmSuggest(leadId);
  const apply = useCrmApply();

  const [applyOk, setApplyOk] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  if (suggest.isLoading) {
    return <Skeleton className="h-44 w-full" />;
  }

  if (suggest.isError || !suggest.data) {
    return null;
  }

  const { data } = suggest;
  const actionLabel = t(`agents.crm.actions.${data.actionCode as CrmActionCode}`, {
    defaultValue: data.actionCode,
  });

  async function handleApplyStage() {
    if (!data.suggestedStage) return;
    setApplyError(null);
    setApplyOk(false);
    try {
      await apply.mutateAsync({
        leadId: data.leadId,
        stageId: data.suggestedStage.id,
      });
      setApplyOk(true);
      await suggest.refetch();
      window.setTimeout(() => setApplyOk(false), 3000);
    } catch (err) {
      setApplyError(getApiErrorMessage(err) ?? t('agents.crm.applyError'));
    }
  }

  const severityStyles =
    data.severity === 'critical'
      ? 'border-red-500/30 bg-red-500/10 text-red-200'
      : data.severity === 'warn'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        : 'border-brand-500/30 bg-brand-500/10 text-brand-200';

  return (
    <Card
      className={cn(
        'border-[color:var(--border)] bg-[color:var(--surface-card)] transition-shadow',
        className,
      )}
      data-testid="crm-copilot-card"
    >
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-brand-400" aria-hidden />
            <span className="text-sm font-semibold">{t('agents.crm.copilotTitle')}</span>
          </div>
        }
        action={
          <Link
            to={`/agents/crm?leadId=${leadId}`}
            className="text-xs text-[color:var(--ink-muted)] hover:text-brand-400 inline-flex items-center gap-1"
          >
            <span>{t('agents.open')}</span>
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        }
      />
      <CardContent className="space-y-3 pt-0">
        <div className={cn('rounded-control border px-3 py-2 text-xs', severityStyles)}>
          <div className="flex items-center justify-between font-semibold">
            <span>{actionLabel}</span>
            <span className="text-[10px] uppercase opacity-75">{data.severity}</span>
          </div>
          <p className="mt-1 text-xs opacity-90 leading-relaxed">{data.rationale}</p>
        </div>

        {data.suggestedStage ? (
          <div className="flex items-center justify-between gap-2 rounded-control bg-[color:var(--surface-subtle)] p-2 text-xs">
            <span className="text-[color:var(--ink-muted)] truncate">
              {data.currentStage?.name ?? t('agents.crm.noStage')}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 text-brand-400" aria-hidden />
            <span className="font-medium text-[color:var(--ink)] truncate">
              {data.suggestedStage.name}
            </span>
          </div>
        ) : null}

        {applyOk ? (
          <p className="flex items-center gap-1 text-xs text-emerald-300">
            <Check className="h-3.5 w-3.5" aria-hidden />
            {t('agents.crm.applySuccess')}
          </p>
        ) : null}

        {applyError ? (
          <p className="flex items-center gap-1 text-xs text-red-300" role="alert">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            {applyError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {onOpenWhatsApp && (data.actionCode === 'PRIORITIZE_OUTREACH' || data.actionCode === 'FOLLOW_UP_OVERDUE') ? (
            <Button
              size="sm"
              onClick={onOpenWhatsApp}
              data-testid="copilot-open-whatsapp"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              {t('agents.crm.openWhatsAppModal')}
            </Button>
          ) : null}

          {data.canApplyStage && data.suggestedStage ? (
            <Button
              size="sm"
              variant={onOpenWhatsApp ? 'secondary' : 'primary'}
              loading={apply.isPending}
              onClick={() => void handleApplyStage()}
              data-testid="copilot-apply-stage"
            >
              <Workflow className="h-3.5 w-3.5" aria-hidden />
              {t('agents.crm.moveStage')}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
