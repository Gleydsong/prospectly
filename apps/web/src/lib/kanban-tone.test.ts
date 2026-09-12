import { describe, expect, it } from 'vitest';

import { LeadStatus } from '@/types';
import { kanbanToneFromLeadStatus, kanbanToneFromStage } from './kanban-tone';

describe('kanbanToneFromLeadStatus', () => {
  it('maps prospecting, contact, closed and neutral statuses', () => {
    expect(kanbanToneFromLeadStatus(LeadStatus.NEW)).toBe('prospecting');
    expect(kanbanToneFromLeadStatus(LeadStatus.CONTACTED)).toBe('contact');
    expect(kanbanToneFromLeadStatus(LeadStatus.WON)).toBe('closed');
    expect(kanbanToneFromLeadStatus(LeadStatus.LOST)).toBe('neutral');
  });
});

describe('kanbanToneFromStage', () => {
  it('uses stage names when they match the visual language', () => {
    expect(kanbanToneFromStage('Prospecção', 0)).toBe('prospecting');
    expect(kanbanToneFromStage('Contato', 1)).toBe('contact');
    expect(kanbanToneFromStage('Fechado', 2)).toBe('closed');
  });

  it('cycles tones when the name is unknown', () => {
    expect(kanbanToneFromStage('Custom A', 0)).toBe('prospecting');
    expect(kanbanToneFromStage('Custom B', 1)).toBe('contact');
  });
});
