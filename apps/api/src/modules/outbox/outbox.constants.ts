export const OUTBOX_QUEUE = 'outbox';
export const PUBLISH_OUTBOX_JOB = 'publish-outbox-event';

export const LEAD_STAGE_CHANGED_TYPE = 'lead.stage_changed';
export const LEAD_STAGE_CHANGED_SCHEMA_VERSION = 1;
export const LEAD_CREATED_TYPE = 'lead.created';
export const LEAD_CREATED_SCHEMA_VERSION = 1;
export const LEAD_DO_NOT_CONTACT_SET_TYPE = 'lead.do_not_contact_set';
export const LEAD_DO_NOT_CONTACT_SET_SCHEMA_VERSION = 1;
export const TASK_COMPLETED_TYPE = 'task.completed';
export const TASK_COMPLETED_SCHEMA_VERSION = 1;
export const LEAD_AGGREGATE_TYPE = 'Lead';
export const TASK_AGGREGATE_TYPE = 'Task';

export const OUTBOX_MAX_ATTEMPTS = 10;
export const OUTBOX_RETAIN_DAYS = 90;
export const OUTBOX_PROCESSING_STALE_MS = 2 * 60 * 1000;
export const OUTBOX_WORKER_CONCURRENCY = 2;
export const OUTBOX_PROCESSOR_OPTIONS = {
  concurrency: OUTBOX_WORKER_CONCURRENCY,
} as const;

export const OUTBOX_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1_000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

export type PublishOutboxJobData = {
  eventId: string;
  organizationId: string;
  correlationId?: string;
};

export type LeadStageChangedPayload = {
  leadId: string;
  fromStageId: string | null;
  toStageId: string;
  fromStageName: string | null;
  toStageName: string;
};

export type LeadCreatedPayload = {
  leadId: string;
  source: string;
  ownerId: string | null;
  stageId: string | null;
};

export type LeadDoNotContactSetPayload = {
  leadId: string;
  source: string;
  campaignId: string | null;
};

export type TaskCompletedPayload = {
  taskId: string;
  leadId: string | null;
  campaignId: string | null;
  campaignStageId: string | null;
};

export function outboxJobId(eventId: string): string {
  return `outbox-${eventId}`;
}
