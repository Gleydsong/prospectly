import { LeadStatus } from '@/types';

export type KanbanTone = 'prospecting' | 'contact' | 'closed' | 'neutral';

const TONES: KanbanTone[] = ['prospecting', 'contact', 'closed', 'neutral'];

export function kanbanToneFromLeadStatus(status: LeadStatus): KanbanTone {
  switch (status) {
    case LeadStatus.NEW:
    case LeadStatus.TO_REVIEW:
    case LeadStatus.QUALIFIED:
      return 'prospecting';
    case LeadStatus.CONTACTED:
    case LeadStatus.RESPONDED:
    case LeadStatus.MEETING_SCHEDULED:
    case LeadStatus.PROPOSAL_SENT:
    case LeadStatus.NEGOTIATION:
      return 'contact';
    case LeadStatus.WON:
      return 'closed';
    default:
      return 'neutral';
  }
}

export function kanbanToneFromStage(name: string, index: number): KanbanTone {
  const normalized = name.toLowerCase();
  if (/prospec|novo|new|qualif|to[_ ]?review/.test(normalized)) return 'prospecting';
  if (/contato|contact|reuni|meeting|proposta|proposal|negoc/.test(normalized)) return 'contact';
  if (/fechado|ganho|won|closed/.test(normalized)) return 'closed';
  if (/perdido|lost|arquiv|disqual/.test(normalized)) return 'neutral';
  return TONES[index % TONES.length] ?? 'neutral';
}

const TONE_CLASS: Record<KanbanTone, string> = {
  prospecting: 'kanban-tone-prospecting',
  contact: 'kanban-tone-contact',
  closed: 'kanban-tone-closed',
  neutral: 'kanban-tone-neutral',
};

export function kanbanToneClass(tone: KanbanTone): string {
  return TONE_CLASS[tone];
}
