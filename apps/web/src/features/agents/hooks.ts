import { useMutation, useQuery } from '@tanstack/react-query';

import {
  applyCrmAction,
  buildWhatsappFirstMessage,
  fetchAgentsCatalog,
  fetchWhatsappVariants,
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

export function useWhatsappVariants(leadId: string | undefined, count = 4, seed = 0) {
  return useQuery({
    queryKey: ['agents', 'whatsapp', 'variants', leadId, count, seed],
    queryFn: () => fetchWhatsappVariants({ leadId: leadId!, count, seed }),
    enabled: Boolean(leadId),
  });
}
