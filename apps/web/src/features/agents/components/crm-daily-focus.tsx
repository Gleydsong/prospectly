import {
  Clock,
  ExternalLink,
  Flame,
  MessageCircle,
  Sparkles,
  TimerOff,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScoreBadge } from '@/components/ui/score-badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { DailyFocusItem } from '@/features/agents/api';
import { useCrmDailyFocus } from '@/features/agents/hooks';
import type { WhatsAppOutreachModalLead } from './whatsapp-outreach-modal';
import { cn } from '@/lib/utils';

export interface CrmDailyFocusProps {
  onSelectLeadForWhatsApp?: (lead: WhatsAppOutreachModalLead) => void;
  className?: string;
}

type TabKey = 'overdue' | 'hot' | 'stale';

export function CrmDailyFocus({ onSelectLeadForWhatsApp, className }: CrmDailyFocusProps) {
  const { t } = useTranslation();
  const dailyFocus = useCrmDailyFocus();
  const [activeTab, setActiveTab] = useState<TabKey>('overdue');

  if (dailyFocus.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (dailyFocus.isError || !dailyFocus.data) {
    return null;
  }

  const items = dailyFocus.data.items ?? [];
  const overdueTasks = items.filter((i) => i.reason === 'OVERDUE_TASK');
  const hotLeads = items.filter((i) => i.reason === 'HOT_NEW_LEAD');
  const staleLeads = items.filter((i) => i.reason === 'STALE_PIPELINE');

  const overdueTasksCount = overdueTasks.length;
  const hotLeadsCount = hotLeads.length;
  const staleLeadsCount = staleLeads.length;

  function renderItemList(list: DailyFocusItem[], emptyMessage: string) {
    if (list.length === 0) {
      return (
        <p className="py-6 text-center text-xs text-[color:var(--ink-muted)]">
          {emptyMessage}
        </p>
      );
    }

    return (
      <ul className="divide-y divide-[color:var(--border)] max-h-72 overflow-y-auto">
        {list.map((item) => (
          <li key={item.taskId ?? `${item.leadId}-${item.reason}`} className="flex items-center justify-between py-2.5 gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-[color:var(--ink)] truncate">
                  {item.companyName}
                </span>
                {item.score != null ? <ScoreBadge score={item.score} /> : null}
              </div>
              <p className="text-[11px] text-[color:var(--ink-muted)] truncate">
                {item.description}
                {item.stageName ? ` · ${item.stageName}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {item.leadId && onSelectLeadForWhatsApp && item.phone ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-brand-300"
                  onClick={() =>
                    onSelectLeadForWhatsApp({
                      id: item.leadId,
                      companyName: item.companyName,
                      phone: item.phone,
                    })
                  }
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                </Button>
              ) : null}
              {item.leadId ? (
                <Link to={`/leads/${item.leadId}`}>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card className={cn('border-[color:var(--border)] bg-[color:var(--surface-card)]', className)}>
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-400" aria-hidden />
            <span>{t('agents.crm.dailyFocusTitle')}</span>
          </div>
        }
        description={t('agents.crm.dailyFocusSubtitle')}
      />
      <CardContent className="space-y-4 pt-0">
        {/* Tab switcher */}
        <div className="flex flex-wrap gap-1 border-b border-[color:var(--border)] pb-2">
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-medium transition-colors',
              activeTab === 'overdue'
                ? 'bg-red-500/15 text-red-300 font-semibold'
                : 'text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)]',
            )}
            onClick={() => setActiveTab('overdue')}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden />
            <span>{t('agents.crm.overdueTasks')}</span>
            {overdueTasksCount > 0 ? (
              <span className="rounded-full bg-red-500/20 px-1.5 py-0.2 text-[10px] text-red-300">
                {overdueTasksCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-medium transition-colors',
              activeTab === 'hot'
                ? 'bg-amber-500/15 text-amber-300 font-semibold'
                : 'text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)]',
            )}
            onClick={() => setActiveTab('hot')}
          >
            <Flame className="h-3.5 w-3.5" aria-hidden />
            <span>{t('agents.crm.hotLeads')}</span>
            {hotLeadsCount > 0 ? (
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] text-amber-300">
                {hotLeadsCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-medium transition-colors',
              activeTab === 'stale'
                ? 'bg-blue-500/15 text-blue-300 font-semibold'
                : 'text-[color:var(--ink-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)]',
            )}
            onClick={() => setActiveTab('stale')}
          >
            <TimerOff className="h-3.5 w-3.5" aria-hidden />
            <span>{t('agents.crm.staleLeads')}</span>
            {staleLeadsCount > 0 ? (
              <span className="rounded-full bg-blue-500/20 px-1.5 py-0.2 text-[10px] text-blue-300">
                {staleLeadsCount}
              </span>
            ) : null}
          </button>
        </div>

        {/* Tab contents */}
        {activeTab === 'overdue' && renderItemList(overdueTasks, t('agents.crm.emptyOverdue'))}
        {activeTab === 'hot' && renderItemList(hotLeads, t('agents.crm.emptyHot'))}
        {activeTab === 'stale' && renderItemList(staleLeads, t('agents.crm.emptyStale'))}
      </CardContent>
    </Card>
  );
}
