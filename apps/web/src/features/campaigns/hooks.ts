import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addCampaignLeads,
  createCampaign,
  createMessageTemplate,
  createStageTasks,
  fetchCampaign,
  fetchCampaignLeads,
  fetchCampaignMetrics,
  fetchCampaigns,
  fetchMessageTemplates,
  fetchTemplateVariables,
  previewMessageTemplate,
  recordCampaignLeadResult,
  removeCampaignLead,
  updateCampaignStatus,
  updateMessageTemplate,
  type AddCampaignLeadsInput,
  type CampaignLeadResult,
  type CampaignStatus,
  type CreateCampaignInput,
  type CreateTemplateInput,
} from './api';

export function useCampaigns(
  params: {
    page?: number;
    pageSize?: number;
    status?: CampaignStatus;
  } = {},
) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: () => fetchCampaigns(params),
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ['campaigns', id],
    queryFn: () => fetchCampaign(id!),
    enabled: Boolean(id),
  });
}

export function useCampaignMetrics(id: string | undefined) {
  return useQuery({
    queryKey: ['campaigns', id, 'metrics'],
    queryFn: () => fetchCampaignMetrics(id!),
    enabled: Boolean(id),
  });
}

export function useCampaignLeads(
  id: string | undefined,
  params: { page?: number; pageSize?: number; status?: string; stageId?: string } = {},
) {
  return useQuery({
    queryKey: ['campaigns', id, 'leads', params],
    queryFn: () => fetchCampaignLeads(id!, params),
    enabled: Boolean(id),
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCampaignInput) => createCampaign(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useUpdateCampaignStatus(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: CampaignStatus) => updateCampaignStatus(campaignId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useAddCampaignLeads(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddCampaignLeadsInput) => addCampaignLeads(campaignId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] });
    },
  });
}

export function useRemoveCampaignLead(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => removeCampaignLead(campaignId, leadId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] });
    },
  });
}

export function useCreateStageTasks(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, leadIds }: { stageId: string; leadIds?: string[] }) =>
      createStageTasks(campaignId, stageId, { leadIds }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] });
    },
  });
}

export function useRecordCampaignLeadResult(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      leadId: string;
      result: CampaignLeadResult;
      note?: string;
      nextAction?: string;
      followUpAt?: string;
      stageId?: string;
    }) =>
      recordCampaignLeadResult(campaignId, input.leadId, {
        result: input.result,
        note: input.note,
        nextAction: input.nextAction,
        followUpAt: input.followUpAt,
        stageId: input.stageId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] });
    },
  });
}

export function useMessageTemplates(params: { page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: ['message-templates', params],
    queryFn: () => fetchMessageTemplates(params),
  });
}

export function useTemplateVariables() {
  return useQuery({
    queryKey: ['message-templates', 'variables'],
    queryFn: fetchTemplateVariables,
  });
}

export function useCreateMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTemplateInput) => createMessageTemplate(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['message-templates'] });
    },
  });
}

export function useUpdateMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<CreateTemplateInput> & { id: string }) =>
      updateMessageTemplate(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['message-templates'] });
    },
  });
}

export function usePreviewMessageTemplate() {
  return useMutation({
    mutationFn: previewMessageTemplate,
  });
}
