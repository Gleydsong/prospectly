export const AUDIT_ACTIONS = {
  LEAD_STAGE_CHANGED: 'lead.stage_changed',
  IMPORT_STARTED: 'import.started',
  ORG_SETTINGS_UPDATED: 'organization.settings_updated',
  ORG_MEMBER_INVITED: 'organization.member_invited',
  ORG_MEMBER_ROLE_UPDATED: 'organization.member_role_updated',
  ORG_MEMBER_REMOVED: 'organization.member_removed',
  DSR_CREATED: 'data_subject_request.created',
  DSR_APPROVED: 'data_subject_request.approved',
  DSR_COMPLETED: 'data_subject_request.completed',
  CAMPAIGN_CREATED: 'campaign.created',
  CAMPAIGN_STATUS_CHANGED: 'campaign.status_changed',
  CAMPAIGN_LEADS_ADDED: 'campaign.leads_added',
  CAMPAIGN_LEAD_REMOVED: 'campaign.lead_removed',
  CAMPAIGN_RESULT_RECORDED: 'campaign.result_recorded',
  CAMPAIGN_TASKS_CREATED: 'campaign.tasks_created',
  MESSAGE_TEMPLATE_CREATED: 'message_template.created',
  MESSAGE_TEMPLATE_UPDATED: 'message_template.updated',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Keys (case-insensitive) never persisted in AuditLog.metadata. */
export const AUDIT_REDACTED_KEY_PATTERN =
  /password|token|secret|authorization|cookie|csv|content|body|refresh|credential|api[_-]?key|private/i;
