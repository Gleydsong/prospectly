import { describe, expect, it } from 'vitest';

import { resolveWhatsappCompose } from './whatsapp-compose';
import type { WhatsappVariant } from './api';

const variants: WhatsappVariant[] = [
  { id: 'v-direto', angle: 'direto', label: 'Direto', body: 'Olá! Vi o Salão Resenha em Recife.' },
  {
    id: 'v-curiosidade',
    angle: 'curiosidade',
    label: 'Curiosidade',
    body: 'Oi! Curiosidade rápida sobre o Salão Resenha.',
  },
];

const base = {
  variants,
  selectedVariantId: '',
  previewDraft: null as string | null,
  showSavedTemplates: false,
  templates: [] as Array<{ id: string; category: string }>,
  templateId: '',
  templateBody: undefined as string | undefined,
  sequenceStage: 'FIRST_MESSAGE' as const,
  followUpOverride: null as boolean | null,
  pipelineStages: [] as Array<{ id: string; name: string }>,
  currentStageId: null as string | null,
  stageIdOverride: null as string | null,
  advanceOverride: null as boolean | null,
};

describe('resolveWhatsappCompose', () => {
  it('fills preview from the first variant when the operator has not chosen or edited', () => {
    const result = resolveWhatsappCompose(base);

    expect(result.previewBody).toBe('Olá! Vi o Salão Resenha em Recife.');
    expect(result.selectedVariant?.id).toBe('v-direto');
    expect(result.scheduleFollowUp).toBe(true);
  });

  it('keeps an edited preview instead of mirroring a later variant payload', () => {
    const result = resolveWhatsappCompose({
      ...base,
      selectedVariantId: 'v-direto',
      previewDraft: 'Mensagem editada',
    });

    expect(result.previewBody).toBe('Mensagem editada');
  });

  it('uses the chosen variant body', () => {
    const result = resolveWhatsappCompose({
      ...base,
      selectedVariantId: 'v-curiosidade',
    });

    expect(result.previewBody).toBe('Oi! Curiosidade rápida sobre o Salão Resenha.');
    expect(result.selectedVariant?.id).toBe('v-curiosidade');
  });

  it('uses the saved template body when the operator opens saved templates', () => {
    const result = resolveWhatsappCompose({
      ...base,
      showSavedTemplates: true,
      templates: [
        { id: 'email-1', category: 'EMAIL' },
        { id: 'wa-1', category: 'WHATSAPP' },
      ],
      templateBody: 'Olá {{contactName}}, vi a {{companyName}}.',
    });

    expect(result.templateId).toBe('wa-1');
    expect(result.previewBody).toBe('Olá {{contactName}}, vi a {{companyName}}.');
  });

  it('turns follow-up off for later sequence stages unless overridden', () => {
    expect(resolveWhatsappCompose({ ...base, sequenceStage: 'BREAKUP' }).scheduleFollowUp).toBe(
      false,
    );
    expect(
      resolveWhatsappCompose({
        ...base,
        sequenceStage: 'BREAKUP',
        followUpOverride: true,
      }).scheduleFollowUp,
    ).toBe(true);
  });

  it('suggests the next pipeline stage without storing it in an effect', () => {
    const result = resolveWhatsappCompose({
      ...base,
      pipelineStages: [
        { id: 's1', name: 'Novo Lead' },
        { id: 's2', name: 'Contatado' },
      ],
      currentStageId: 's1',
    });

    expect(result.newStageId).toBe('s2');
    expect(result.advancePipeline).toBe(true);
  });
});
