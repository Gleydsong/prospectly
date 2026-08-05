export const LANDING_GENERATION_QUEUE = 'conversion-landing-generate';
export const GENERATE_LANDING_JOB = 'generate-landing';
export const REFINE_LANDING_JOB = 'refine-landing';
export const LANDING_PROMPT_VERSION = 'v5-react-aura-blocks';

export type GenerateLandingJobData = {
  organizationId: string;
  pageId: string;
  actorId: string;
  correlationId?: string;
  mode: 'AI_LEAD' | 'AI_DESCRIBE' | 'AI_GOOGLE' | 'TEMPLATE';
  useAi: boolean;
  describeText?: string;
  googleLink?: string;
};

export type RefineLandingJobData = {
  organizationId: string;
  pageId: string;
  actorId: string;
  correlationId?: string;
  instruction: string;
};
