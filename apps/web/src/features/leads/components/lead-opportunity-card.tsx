import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScoreBadge } from '@/components/ui/score-badge';
import { humanizeRecommendedAction } from '@/features/leads/components/lead-contact-channels';
import { cn } from '@/lib/utils';

export type LeadScoreSnapshot = {
  score: number;
  fit: number;
  opportunity: number;
  engagement: number;
  recommendedAction?: string | null;
  configVersion: number;
  rulesApplied: Array<{ key: string; points: number; dimension?: string }>;
  missingData?: string[];
};

const SELLER_COPY: Record<string, string> = {
  PRIORITIZE_OUTREACH:
    'Cliente com sinal de compra. Abra o WhatsApp e faça o primeiro contato agora.',
  NURTURE: 'Relação ainda fria. Registre um toque curto e combine um retorno.',
  ENRICH_CONTACT: 'Falta telefone ou e-mail. Complete o contato antes de abordar.',
  RUN_WEBSITE_ANALYSIS: 'Há URL para checar. Use a análise do site como argumento na abordagem.',
  ADVANCE_PIPELINE: 'O próximo passo é avançar a etapa no funil acima.',
  ENRICH_PROFILE: 'Complete dados do perfil para a pontuação ficar mais confiável.',
  RESPECT_DNC: 'Cliente marcado para não contatar. Não faça outreach.',
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function DimensionBar({ label, value }: { label: string; value: number }) {
  const percent = clampPercent(value);
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium uppercase tracking-wide text-[color:var(--ink-muted)]">
          {label}
        </span>
        <span className="tabular-nums text-[color:var(--ink)]">{percent}</span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-subtle)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-[color:var(--status-info-ink)]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function LeadOpportunityCard({
  score,
  snapshot,
  blocked,
  onWhatsApp,
  onCrm,
}: {
  score: number;
  snapshot?: LeadScoreSnapshot | null;
  blocked?: boolean;
  onWhatsApp?: () => void;
  onCrm?: () => void;
}) {
  const { t } = useTranslation();
  const action = snapshot?.recommendedAction ?? 'NURTURE';
  const actionLabel = t(`scoreExplain.actions.${action}`, {
    defaultValue: humanizeRecommendedAction(action),
  });
  const sellerCopy = SELLER_COPY[action] ?? actionLabel;
  const showWhatsApp = Boolean(!blocked && onWhatsApp);
  const visibleMissing = (snapshot?.missingData ?? []).filter((field) => field !== 'website');

  return (
    <Card>
      <CardHeader
        title="Pontuação de oportunidade"
        description="Tradução da nota para a equipe comercial — o que fazer agora."
        action={<ScoreBadge score={snapshot?.score ?? score} />}
      />
      <CardContent className="space-y-4">
        {snapshot ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <DimensionBar
                label={t('scoreExplain.fit', { defaultValue: 'Aderência' })}
                value={snapshot.fit}
              />
              <DimensionBar
                label={t('scoreExplain.opportunity', { defaultValue: 'Oportunidade' })}
                value={snapshot.opportunity}
              />
              <DimensionBar
                label={t('scoreExplain.engagement', { defaultValue: 'Engajamento' })}
                value={snapshot.engagement}
              />
            </div>

            <div
              className={cn(
                'rounded-control border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3.5',
              )}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--ink-muted)]">
                {t('scoreExplain.recommendedAction', { defaultValue: 'Ação recomendada' })}
              </p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--ink)]">{actionLabel}</p>
              <p className="mt-1 text-sm leading-relaxed text-[color:var(--ink-muted)]">
                {sellerCopy}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {showWhatsApp && onWhatsApp ? (
                  <Button size="sm" onClick={onWhatsApp}>
                    Iniciar abordagem via WhatsApp
                  </Button>
                ) : null}
                {onCrm ? (
                  <Button size="sm" variant={showWhatsApp ? 'outline' : 'primary'} onClick={onCrm}>
                    Abrir assistente de CRM
                  </Button>
                ) : null}
              </div>
            </div>

            {visibleMissing.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-[color:var(--ink-muted)]">
                  {t('scoreExplain.missingData', { defaultValue: 'Dados ausentes' })}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {visibleMissing.map((field) => (
                    <Badge key={field} tone="amber">
                      {t(`scoreExplain.missing.${field}`, { defaultValue: field })}
                    </Badge>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-[color:var(--ink-muted)]">
            A pontuação detalhada aparece após a primeira análise ou recálculo.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
