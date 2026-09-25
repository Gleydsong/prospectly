import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, MapPin, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import type { SdrWorkspaceView } from './types';

type TabId = 'overview' | 'evidence' | 'messages' | 'history';
type ChannelId = 'EMAIL' | 'WHATSAPP' | 'LINKEDIN';

const TABS: TabId[] = ['overview', 'evidence', 'messages', 'history'];
const RINGS = [
  { key: 'icp', color: '#22c55e' },
  { key: 'websiteNeed', color: '#a855f7' },
  { key: 'activity', color: '#3b82f6' },
  { key: 'contact', color: '#f59e0b' },
  { key: 'opportunity', color: '#f43f5e' },
] as const;

function band(percent: number | null): 'high' | 'mid' | 'low' | 'empty' {
  if (percent == null) return 'empty';
  if (percent >= 75) return 'high';
  if (percent >= 45) return 'mid';
  return 'low';
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? 'S') + (parts[1]?.[0] ?? '');
}

function evidenceCopy(field: string, value: string) {
  if (field === 'ssl' && value === 'absent') {
    return { titleKey: 'ssl', detailKey: 'sslAbsent', tone: 'red' as const };
  }
  if (field === 'mobile' && value === 'missing') {
    return { titleKey: 'mobile', detailKey: 'mobileMissing', tone: 'red' as const };
  }
  if (field === 'pageText') {
    return { titleKey: 'pageText', detailKey: 'pageTextStored', tone: 'slate' as const };
  }
  if (field === 'category') {
    return { titleKey: 'category', detailKey: null, tone: 'mint' as const };
  }
  return { titleKey: null, detailKey: null, tone: 'slate' as const };
}

function ScoreRing({
  label,
  caption,
  percent,
  color,
}: {
  label: string;
  caption: string;
  percent: number | null;
  color: string;
}) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dash = percent == null ? 0 : (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <svg viewBox="0 0 72 72" className="h-16 w-16 shrink-0" aria-hidden>
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-[color:var(--border-default)]"
            strokeWidth="6"
          />
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform="rotate(-90 36 36)"
          />
        </svg>
        <div>
          <p className="text-sm font-semibold text-[color:var(--ink)]">
            {percent == null ? '—' : `${percent}%`}
          </p>
          <p className="text-sm text-[color:var(--ink-secondary)]">{label}</p>
          <p className="sr-only">{caption}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MessagePanel({
  channel,
  onChannel,
  status,
  body,
  used,
  onUse,
}: {
  channel: ChannelId;
  onChannel: (channel: ChannelId) => void;
  status: 'READY' | 'BLOCK';
  body: string | null;
  used: boolean;
  onUse: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['EMAIL', 'WHATSAPP', 'LINKEDIN'] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={`rounded-control px-3 py-1 text-sm ${channel === id ? 'bg-[color:var(--brand-soft)] font-medium text-[color:var(--brand)]' : 'text-[color:var(--ink-muted)]'}`}
            onClick={() => onChannel(id)}
          >
            {t(`sdrUi.channels.${id}`)}
          </button>
        ))}
      </div>
      <Badge tone={status === 'BLOCK' ? 'amber' : 'mint'}>{t(`sdrUi.messageStatus.${status}`)}</Badge>
      <p className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--ink-secondary)]">
        {channel === 'EMAIL' ? (body ?? t('sdrUi.messageEmpty')) : t('sdrUi.channelBlocked')}
      </p>
      <Button type="button" size="sm" variant="outline" disabled={!body || channel !== 'EMAIL'} onClick={onUse}>
        {t('sdrUi.useMessage')}
      </Button>
      {used ? <p className="text-sm">{t('sdrUi.messageSelected')}</p> : null}
    </div>
  );
}

export function SdrWorkspace({ initial }: { initial: SdrWorkspaceView }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>('overview');
  const [channel, setChannel] = useState<ChannelId>('EMAIL');
  const [review, setReview] = useState(initial.review);
  const [audited, setAudited] = useState<string | null>(null);
  const [usedMessage, setUsedMessage] = useState(false);
  const prospect = initial.prospects[0];
  const score = prospect?.score ?? initial.signals?.opportunity ?? null;
  const status = initial.decision?.qualification ?? prospect?.state ?? '—';
  const sendBlocked =
    !initial.autonomy.autonomousSending ||
    initial.message.status === 'BLOCK' ||
    channel !== 'EMAIL';

  function decide(prospectId: string, action: 'approved' | 'rejected') {
    setReview((items) => items.filter((item) => item.prospectId !== prospectId));
    setAudited(action === 'approved' ? t('nav.sdrApproved') : t('nav.sdrRejected'));
  }

  const summary = initial.evidence
    .map((item) => {
      const copy = evidenceCopy(item.field, item.value);
      if (item.field === 'pageText' || !copy.detailKey) return null;
      return t(`sdrUi.evidence.${copy.detailKey}`);
    })
    .filter((line): line is string => Boolean(line))
    .join('. ');

  const signals = {
    icp: initial.signals?.icp ?? null,
    websiteNeed: initial.signals?.websiteNeed ?? null,
    activity: initial.signals?.activity ?? null,
    contact: initial.signals?.contact ?? null,
    opportunity: initial.signals?.opportunity ?? score,
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-[color:var(--ink-secondary)]">
        {initial.autonomy.autonomousSending ? t('sdrUi.sendingOn') : t('nav.sdrSendingOff')}
      </p>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-panel bg-[color:var(--brand-soft)] text-lg font-semibold text-[color:var(--brand)]">
            {initials(prospect?.name ?? 'SDR')}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-[color:var(--ink)]">
              {prospect?.name ?? t('nav.sdr')}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[color:var(--ink-secondary)]">
              {prospect?.geography ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {prospect.geography}
                </span>
              ) : null}
              {prospect?.industry ? <span>{prospect.industry}</span> : null}
            </p>
            <p className="mt-2 text-sm text-[color:var(--ink-secondary)]">
              {initial.campaign.name}
              <span aria-hidden> · </span>
              {t(`sdrUi.campaignStatus.${initial.campaign.status}`, {
                defaultValue: initial.campaign.status,
              })}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
            {t('sdrUi.status')}
          </p>
          <Badge tone={status === 'QUALIFIED' ? 'mint' : 'slate'}>
            {t(`sdrUi.qualifications.${status}`, { defaultValue: status })}
          </Badge>
          <p className="mt-3 text-3xl font-semibold text-[color:var(--ink)]">
            {score ?? '—'}
            <span className="text-base font-medium text-[color:var(--ink-muted)]">/100</span>
          </p>
          <p className="text-xs text-[color:var(--ink-muted)]">{t(`sdrUi.band.${band(score)}`)}</p>
        </div>
      </header>

      <div
        role="tablist"
        aria-label={t('sdrUi.tabsLabel')}
        className="flex gap-1 overflow-x-auto border-b border-[color:var(--border-default)]"
      >
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`whitespace-nowrap px-3 py-2 text-sm ${tab === id ? 'border-b-2 border-[color:var(--brand)] font-medium text-[color:var(--ink)]' : 'text-[color:var(--ink-muted)]'}`}
            onClick={() => setTab(id)}
          >
            {t(`sdrUi.tabs.${id}`)}
          </button>
        ))}
      </div>

      {tab === 'overview' && prospect ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {RINGS.map((ring) => (
            <ScoreRing
              key={ring.key}
              color={ring.color}
              percent={signals[ring.key]}
              label={t(`sdrUi.rings.${ring.key}`)}
              caption={t(`sdrUi.captions.${ring.key}.${band(signals[ring.key])}`)}
            />
          ))}
        </div>
      ) : null}

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--ink)]">
                <Sparkles className="h-4 w-4" aria-hidden />
                {t('sdrUi.suggestedMessage')}
              </h2>
              {initial.brief?.angle ? (
                <div
                  className="rounded-control bg-[color:var(--status-warning-bg)] p-3 text-sm text-[color:var(--status-warning-ink)]"
                  aria-label={t('sdrUi.recommendation')}
                >
                  {t(`sdrUi.angles.${initial.brief.angle}`, {
                    defaultValue: t('sdrUi.angles.default'),
                  })}
                </div>
              ) : null}
              <MessagePanel
                channel={channel}
                onChannel={setChannel}
                status={initial.message.status}
                body={initial.message.body}
                used={usedMessage}
                onUse={() => setUsedMessage(true)}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="text-sm font-semibold text-[color:var(--ink)]">{t('nav.sdrReview')}</h2>
              {summary || initial.brief?.summary ? (
                <button type="button" className="text-left text-sm text-[color:var(--brand)]" onClick={() => setTab('evidence')}>
                  {summary || initial.brief?.summary}
                </button>
              ) : (
                <p className="text-sm text-[color:var(--ink-muted)]">{t('sdrUi.summaryEmpty')}</p>
              )}
              <ul className="space-y-2">
                {review.map((item) => (
                  <li key={item.prospectId} className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{t(`sdrUi.reasons.${item.reason}`, { defaultValue: item.reason })}</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => decide(item.prospectId, 'approved')}>
                      {t('nav.sdrApprove')}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => decide(item.prospectId, 'rejected')}>
                      {t('nav.sdrReject')}
                    </Button>
                  </li>
                ))}
              </ul>
              {audited ? <p className="text-sm">{audited}</p> : null}
              <Button type="button" disabled={sendBlocked} title={sendBlocked ? t('nav.sdrSendingOff') : undefined}>
                <Mail className="mr-2 h-4 w-4" aria-hidden />
                {t('sdrUi.sendEmail')}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'evidence' ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-[color:var(--ink)]">{t('sdrUi.evidenceFound')}</h2>
            <ul className="space-y-3">
              {initial.evidence.map((item) => {
                const copy = evidenceCopy(item.field, item.value);
                return (
                  <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium text-[color:var(--ink)]">
                        {copy.titleKey ? t(`sdrUi.evidence.${copy.titleKey}`) : item.field}
                      </p>
                      <p className="text-[color:var(--ink-secondary)]">
                        {copy.detailKey ? t(`sdrUi.evidence.${copy.detailKey}`) : item.value}
                      </p>
                    </div>
                    <Badge tone={copy.tone}>{t(`sdrUi.evidenceTone.${copy.tone}`)}</Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'messages' ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-[color:var(--ink)]">{t('sdrUi.suggestedMessage')}</h2>
            <MessagePanel
              channel={channel}
              onChannel={setChannel}
              status={initial.message.status}
              body={initial.message.body}
              used={usedMessage}
              onUse={() => setUsedMessage(true)}
            />
          </CardContent>
        </Card>
      ) : null}

      {tab === 'history' ? (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <h2 className="font-semibold">{t('sdrUi.history')}</h2>
            <p>
              {initial.decision
                ? `${t(`sdrUi.qualifications.${initial.decision.qualification}`, { defaultValue: initial.decision.qualification })} · ${initial.decision.traceId}`
                : '—'}
            </p>
            {audited ? <p>{audited}</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
