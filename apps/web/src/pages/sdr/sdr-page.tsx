import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type SdrWorkspaceView = {
  campaign: { name: string; status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' };
  autonomy: {
    autonomousSending: boolean;
    autonomousFollowup: boolean;
    autonomousReply: boolean;
  };
  prospects: Array<{ id: string; name: string; score: number | null; state: string }>;
  evidence: Array<{ id: string; field: string; value: string }>;
  decision: { qualification: string; traceId: string } | null;
  message: { status: 'READY' | 'BLOCK'; body: string | null };
  review: Array<{ prospectId: string; reason: string }>;
  metrics: { blocked: number };
};

export const EMPTY_SDR_WORKSPACE: SdrWorkspaceView = {
  campaign: { name: 'Sem campanha', status: 'DRAFT' },
  autonomy: {
    autonomousSending: false,
    autonomousFollowup: false,
    autonomousReply: false,
  },
  prospects: [],
  evidence: [],
  decision: null,
  message: { status: 'BLOCK', body: null },
  review: [],
  metrics: { blocked: 0 },
};

export function SdrWorkspace({ initial }: { initial: SdrWorkspaceView }) {
  const { t } = useTranslation();
  const [review, setReview] = useState(initial.review);
  const [audited, setAudited] = useState<string | null>(null);

  function decide(prospectId: string, action: 'approved' | 'rejected') {
    setReview((items) => items.filter((item) => item.prospectId !== prospectId));
    setAudited(action === 'approved' ? t('nav.sdrApproved') : t('nav.sdrRejected'));
  }

  return (
    <main className="space-y-6 p-6">
      <h1>{t('nav.sdr')}</h1>
      <p>{initial.autonomy.autonomousSending ? '' : t('nav.sdrSendingOff')}</p>
      <section>
        <h2>{t('nav.sdrCampaign')}</h2>
        <p>
          {initial.campaign.name} · {initial.campaign.status}
        </p>
      </section>
      <section>
        <h2>{t('nav.sdrProspects')}</h2>
        <ul>
          {initial.prospects.map((prospect) => (
            <li key={prospect.id}>
              {prospect.name} · {prospect.state} · {prospect.score ?? '—'}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>{t('nav.sdrEvidence')}</h2>
        <ul>
          {initial.evidence.map((item) => (
            <li key={item.id}>
              {item.field}: {item.value}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>{t('nav.sdrDecision')}</h2>
        <p>
          {initial.decision
            ? `${initial.decision.qualification} · ${initial.decision.traceId}`
            : '—'}
        </p>
      </section>
      <section>
        <h2>{t('nav.sdrMessage')}</h2>
        <p>{initial.message.body ?? initial.message.status}</p>
      </section>
      <section>
        <h2>{t('nav.sdrReview')}</h2>
        <ul>
          {review.map((item) => (
            <li key={item.prospectId}>
              {item.prospectId} · {item.reason}
              <button type="button" onClick={() => decide(item.prospectId, 'approved')}>
                {t('nav.sdrApprove')}
              </button>
              <button type="button" onClick={() => decide(item.prospectId, 'rejected')}>
                {t('nav.sdrReject')}
              </button>
            </li>
          ))}
        </ul>
        {audited ? <p>{audited}</p> : null}
      </section>
      <section>
        <h2>{t('nav.sdrMetrics')}</h2>
        <p>{initial.metrics.blocked}</p>
      </section>
    </main>
  );
}

export function SdrPage() {
  return <SdrWorkspace initial={EMPTY_SDR_WORKSPACE} />;
}
