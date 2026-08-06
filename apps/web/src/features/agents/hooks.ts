import { useMutation, useQuery } from '@tanstack/react-query';

import {
  applyCrmAction,
  buildWhatsappFirstMessage,
  fetchAgentsCatalog,
  suggestCrmAction,
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
