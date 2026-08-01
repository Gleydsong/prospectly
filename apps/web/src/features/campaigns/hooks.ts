import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createCampaign, fetchCampaigns, type CreateCampaignInput, type CampaignStatus } from './api';

export function useCampaigns(params: { page?: number; pageSize?: number; status?: CampaignStatus } = {}) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: () => fetchCampaigns(params),
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
