import { api } from '@/lib/api';

export type AgentCatalogItem = {
  id: 'crm-next-action' | 'whatsapp-first-message';
  name: string;
  description: string;
  path: string;
};

export type CrmActionCode =
  | 'RESPECT_DNC'
  | 'ENRICH_CONTACT'
  | 'FOLLOW_UP_OVERDUE'
  | 'PRIORITIZE_OUTREACH'
  | 'ADVANCE_PIPELINE'
  | 'RUN_WEBSITE_ANALYSIS'
  | 'ENRICH_PROFILE'
  | 'NURTURE';

export type CrmSuggestResult = {
  leadId: string;
  companyName: string;
  score: number | null;
  status: string;
  currentStage: { id: string; name: string; order: number } | null;
  suggestedStage: { id: string; name: string; order: number } | null;
  actionCode: CrmActionCode;
  rationale: string;
  severity: 'info' | 'warn' | 'critical';
  href: string;
  canApplyStage: boolean;
};

export type CrmApplyResult = {
  leadId: string;
  stageId: string | null;
  stage: { id: string; name: string } | null;
  applied: boolean;
};

export type WhatsappFirstMessageResult = {
  leadId: string;
  companyName: string;
  templateId: string;
  templateName: string;
  category: string;
  body: string;
  missing: string[];
  unknown: string[];
  phone: string | null;
  digits: string | null;
  waLink: string | null;
  canOpen: boolean;
  autoSend: false;
  messageSent: false;
};

export async function fetchAgentsCatalog(): Promise<{ data: AgentCatalogItem[] }> {
  const { data } = await api.get<{ data: AgentCatalogItem[] }>('/agents');
  return data;
}

export async function suggestCrmAction(leadId: string): Promise<CrmSuggestResult> {
  const { data } = await api.post<CrmSuggestResult>('/agents/crm/suggest', { leadId });
  return data;
}

export async function applyCrmAction(input: {
  leadId: string;
  stageId?: string;
}): Promise<CrmApplyResult> {
  const { data } = await api.post<CrmApplyResult>('/agents/crm/apply', input);
  return data;
}

export async function buildWhatsappFirstMessage(input: {
  leadId: string;
  templateId?: string;
}): Promise<WhatsappFirstMessageResult> {
  const { data } = await api.post<WhatsappFirstMessageResult>(
    '/agents/whatsapp/first-message',
    input,
  );
  return data;
}
