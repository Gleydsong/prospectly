import type { WhatsappSequenceStage, WhatsappVariant } from './api';

export type WhatsappPipelineStageOption = { id: string; name: string };

export type ResolveWhatsappComposeInput = {
  variants: WhatsappVariant[];
  selectedVariantId: string;
  previewDraft: string | null;
  showSavedTemplates: boolean;
  templates: Array<{ id: string; category: string }>;
  templateId: string;
  templateBody: string | null | undefined;
  sequenceStage: WhatsappSequenceStage;
  followUpOverride: boolean | null;
  pipelineStages: WhatsappPipelineStageOption[];
  currentStageId: string | null | undefined;
  stageIdOverride: string | null;
  advanceOverride: boolean | null;
};

export type ResolvedWhatsappCompose = {
  templateId: string;
  selectedVariant: WhatsappVariant | undefined;
  previewBody: string;
  scheduleFollowUp: boolean;
  newStageId: string;
  advancePipeline: boolean;
};

export function resolveTemplateId(
  templates: Array<{ id: string; category: string }>,
  templateId: string,
): string {
  if (templateId) return templateId;
  const whatsapp = templates.find((item) => item.category.toUpperCase() === 'WHATSAPP');
  return (whatsapp ?? templates[0])?.id ?? '';
}

export function suggestNextPipelineStage(
  stages: WhatsappPipelineStageOption[],
  currentStageId: string | null | undefined,
): WhatsappPipelineStageOption | undefined {
  if (stages.length === 0) return undefined;
  const currentIndex = stages.findIndex((stage) => stage.id === currentStageId);
  if (currentIndex >= 0 && currentIndex + 1 < stages.length) {
    return stages[currentIndex + 1];
  }
  return (
    stages.find((stage) => /contatad|contacted/i.test(stage.name)) ??
    stages.find((stage) => stage.id !== currentStageId)
  );
}

export function resolveWhatsappCompose(
  input: ResolveWhatsappComposeInput,
): ResolvedWhatsappCompose {
  const templateId = resolveTemplateId(input.templates, input.templateId);
  const selectedVariant =
    input.variants.find((item) => item.id === input.selectedVariantId) ?? input.variants[0];
  const previewBody = (() => {
    if (input.previewDraft !== null) return input.previewDraft;
    if (input.showSavedTemplates && input.templateBody != null) return input.templateBody;
    return selectedVariant?.body ?? '';
  })();
  const suggestedStage = suggestNextPipelineStage(input.pipelineStages, input.currentStageId);

  return {
    templateId,
    selectedVariant,
    previewBody,
    scheduleFollowUp:
      input.followUpOverride ??
      (input.sequenceStage === 'FIRST_MESSAGE' || input.sequenceStage === 'FOLLOW_UP_1'),
    newStageId: input.stageIdOverride ?? suggestedStage?.id ?? '',
    advancePipeline: input.advanceOverride ?? Boolean(suggestedStage),
  };
}
