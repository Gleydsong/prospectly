export type SdrWorkspaceView = {
  campaign: {
    name: string;
    status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
    objective?: string;
    icp?: string;
    channel?: string;
    maxProspectsPerDay?: number;
    maxMessagesPerDay?: number;
    maxFollowUps?: number;
  };
  autonomy: {
    autonomousSending: boolean;
    autonomousFollowup: boolean;
    autonomousReply: boolean;
  };
  prospects: Array<{
    id: string;
    name: string;
    score: number | null;
    state: string;
    geography?: string;
    industry?: string;
  }>;
  signals?: {
    icp: number | null;
    websiteNeed: number | null;
    activity: number | null;
    contact: number | null;
    opportunity: number | null;
  };
  evidence: Array<{ id: string; field: string; value: string }>;
  decision: { qualification: string; traceId: string } | null;
  brief?: { angle: string; summary: string } | null;
  message: { status: 'READY' | 'BLOCK'; body: string | null };
  review: Array<{ prospectId: string; reason: string }>;
  metrics: { blocked: number };
  seenLeadIds?: string[];
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
