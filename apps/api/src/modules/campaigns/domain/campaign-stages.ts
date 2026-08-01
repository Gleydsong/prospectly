export const CAMPAIGN_STAGE_TYPES = ['EMAIL_MANUAL', 'CALL', 'WHATSAPP', 'LINKEDIN'] as const;

export type CampaignStageType = (typeof CAMPAIGN_STAGE_TYPES)[number];

export interface StageMetricsPlaceholder {
  delivered: number;
  replied: number;
  interested: number;
  meeting: number;
  proposal: number;
  won: number;
}

export interface CampaignStageDefinition {
  id: string;
  type: CampaignStageType;
  name: string;
  order: number;
  templateId?: string;
  metrics: StageMetricsPlaceholder;
}

export interface CampaignContactRules {
  entryStatus?: string;
  exitStatus?: string;
  frequencyDays?: number;
  ownerId?: string;
  contactWindowStart?: string;
  contactWindowEnd?: string;
}

export interface CampaignMetricsPayload {
  stages: CampaignStageDefinition[];
  rules?: CampaignContactRules;
}

export function emptyStageMetrics(): StageMetricsPlaceholder {
  return {
    delivered: 0,
    replied: 0,
    interested: 0,
    meeting: 0,
    proposal: 0,
    won: 0,
  };
}

export function defaultStages(): CampaignStageDefinition[] {
  return [
    {
      id: crypto.randomUUID(),
      type: 'EMAIL_MANUAL',
      name: 'E-mail manual',
      order: 1,
      metrics: emptyStageMetrics(),
    },
    {
      id: crypto.randomUUID(),
      type: 'CALL',
      name: 'Ligação',
      order: 2,
      metrics: emptyStageMetrics(),
    },
    {
      id: crypto.randomUUID(),
      type: 'WHATSAPP',
      name: 'WhatsApp',
      order: 3,
      metrics: emptyStageMetrics(),
    },
    {
      id: crypto.randomUUID(),
      type: 'LINKEDIN',
      name: 'LinkedIn',
      order: 4,
      metrics: emptyStageMetrics(),
    },
  ];
}

export function stageTaskTitle(stage: CampaignStageDefinition, companyName: string): string {
  const labels: Record<CampaignStageType, string> = {
    EMAIL_MANUAL: 'Enviar e-mail',
    CALL: 'Ligar para',
    WHATSAPP: 'Mensagem WhatsApp para',
    LINKEDIN: 'Contatar no LinkedIn',
  };
  return `${labels[stage.type]} — ${companyName}`;
}

export function parseCampaignMetrics(raw: unknown): CampaignMetricsPayload {
  if (!raw || typeof raw !== 'object') {
    return { stages: [] };
  }
  const payload = raw as Partial<CampaignMetricsPayload>;
  const stages = Array.isArray(payload.stages) ? payload.stages : [];
  return {
    stages: stages.filter(
      (s): s is CampaignStageDefinition =>
        !!s &&
        typeof s === 'object' &&
        typeof s.id === 'string' &&
        typeof s.name === 'string' &&
        typeof s.order === 'number' &&
        CAMPAIGN_STAGE_TYPES.includes(s.type as CampaignStageType),
    ),
    rules: payload.rules,
  };
}
