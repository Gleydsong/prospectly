import { useMutation, useQuery } from '@tanstack/react-query';

import {
  applyCrmAction,
  buildWhatsappFirstMessage,
  fetchAgentsCatalog,
  fetchCrmDailyFocus,
  fetchWhatsappVariants,
  recordWhatsappOutreach,
  suggestCrmAction,
  type WhatsappSequenceStage,
} from './api';

export function useAgentsCatalog() {
  return useQuery({
    queryKey: ['agents', 'catalog'],
    queryFn: fetchAgentsCatalog,
  });
}

export function useCrmSuggest(leadId: string | undefined) {
  return useQuery({
    queryKey: ['agents', 'crm', 'suggest', leadId],
    queryFn: () => suggestCrmAction(leadId!),
    enabled: Boolean(leadId),
  });
}

export function useCrmApply() {
  return useMutation({
    mutationFn: applyCrmAction,
  });
}

export function useCrmDailyFocus() {
  return useQuery({
    queryKey: ['agents', 'crm', 'daily-focus'],
    queryFn: fetchCrmDailyFocus,
  });
}

export function useWhatsappFirstMessage(leadId: string | undefined, templateId: string | undefined) {
  return useQuery({
    queryKey: ['agents', 'whatsapp', 'first-message', leadId, templateId],
    queryFn: () =>
      buildWhatsappFirstMessage({
        leadId: leadId!,
        templateId: templateId || undefined,
      }),
    enabled: Boolean(leadId && templateId),
  });
}

export function useWhatsappVariants(
  leadId: string | undefined,
  count = 4,
  seed = 0,
  sequenceStage: WhatsappSequenceStage = 'FIRST_MESSAGE',
) {
  return useQuery({
    queryKey: ['agents', 'whatsapp', 'variants', leadId, count, seed, sequenceStage],
    queryFn: () => fetchWhatsappVariants({ leadId: leadId!, count, seed, sequenceStage }),
    enabled: Boolean(leadId),
  });
}

export function useWhatsappRecordOutreach() {
  return useMutation({
    mutationFn: recordWhatsappOutreach,
  });
}

