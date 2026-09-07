import type { SearchImportSummary, Task } from '@/types';

export const TASK_STATUS_LABELS: Record<Task['status'], string> = {
  OPEN: 'Aberta',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluída',
  CANCELLED: 'Cancelada',
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  CALL: 'Ligação',
  EMAIL: 'E-mail',
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  MEETING: 'Reunião',
  NOTE: 'Nota',
  TASK: 'Tarefa',
  PROPOSAL_SENT: 'Proposta enviada',
  STATUS_CHANGED: 'Status',
  OWNER_CHANGED: 'Responsável',
  STAGE_CHANGED: 'Funil',
};

type SearchImportStatus = NonNullable<SearchImportSummary['items']>[number]['status'];

const SEARCH_IMPORT_STATUS_LABELS: Record<SearchImportStatus, string> = {
  IMPORTED: 'Importado',
  SKIPPED: 'Ignorado',
  INVALID: 'Inválido',
  CONFLICT: 'Possível duplicidade',
};

const MESSAGE_TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  EMAIL: 'E-mail',
  WHATSAPP: 'WhatsApp',
  LINKEDIN: 'LinkedIn',
  CALL: 'Ligação',
  GENERAL: 'Geral',
};

export function formatActivityType(type: string): string {
  return ACTIVITY_TYPE_LABELS[type] ?? 'Atividade';
}

export function formatSearchImportStatus(status: SearchImportStatus): string {
  return SEARCH_IMPORT_STATUS_LABELS[status];
}

export function formatMessageTemplateCategory(category?: string | null): string {
  if (!category) return 'Geral';
  return MESSAGE_TEMPLATE_CATEGORY_LABELS[category] ?? 'Outra categoria';
}
