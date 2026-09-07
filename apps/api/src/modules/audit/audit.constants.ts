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
  CONSENT_CHANGED: 'consent.changed',
  ACCOUNT_ANONYMIZED: 'account.anonymized',
  DATA_EXPORTED: 'privacy.data_exported',
  PRIVACY_CORRECTION: 'privacy.correction',
  CAMPAIGN_CREATED: 'campaign.created',
  CAMPAIGN_STATUS_CHANGED: 'campaign.status_changed',
  CAMPAIGN_LEADS_ADDED: 'campaign.leads_added',
  CAMPAIGN_LEAD_REMOVED: 'campaign.lead_removed',
  CAMPAIGN_RESULT_RECORDED: 'campaign.result_recorded',
  CAMPAIGN_TASKS_CREATED: 'campaign.tasks_created',
  MESSAGE_TEMPLATE_CREATED: 'message_template.created',
  MESSAGE_TEMPLATE_UPDATED: 'message_template.updated',
  SAVED_VIEW_CREATED: 'saved_view.created',
  SAVED_VIEW_UPDATED: 'saved_view.updated',
  SAVED_VIEW_ARCHIVED: 'saved_view.archived',
  SAVED_VIEW_DUPLICATED: 'saved_view.duplicated',
  WORKFLOW_CREATED: 'workflow.created',
  WORKFLOW_UPDATED: 'workflow.updated',
  WORKFLOW_PUBLISHED: 'workflow.published',
  WORKFLOW_PAUSED: 'workflow.paused',
  WORKFLOW_ARCHIVED: 'workflow.archived',
  GOOGLE_CONNECTION_CONNECTED: 'google_connection.connected',
  GOOGLE_CONNECTION_DISCONNECTED: 'google_connection.disconnected',
  GOOGLE_CONNECTION_REVOKED: 'google_connection.revoked',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Keys (case-insensitive) never persisted in AuditLog.metadata. */
export const AUDIT_REDACTED_KEY_PATTERN =
  /password|token|secret|authorization|cookie|csv|content|body|refresh|credential|api[_-]?key|private|cpf|cnpj|phone|whatsapp/i;
