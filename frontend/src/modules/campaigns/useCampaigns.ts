import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { invalidateOrganizationScopedQueryPrefixes, organizationQueryKey } from '@/core/queryKeys';
import type { RootState } from '@/core/store';
import type { Campaign, CampaignMessage, ApiResponse, PaginationMeta } from '@/core/types';
import type { CreateCampaignFormData, UpdateCampaignFormData } from './validations';
import { useOrganizationContext } from '@/modules/organizations/useOrganizationContext';
import { buildListQuery } from '@/shared/utils/listing';

interface CampaignListParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}

interface CampaignAnalytics {
  campaign_id: string;
  campaign_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  summary: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    pending: number;
  };
  rates: {
    delivery_rate: number;
    read_rate: number;
    failure_rate: number;
  };
  failure_reasons: Array<{ reason: string; count: number }>;
  cost: { estimated: number; actual: number };
  hourly_timeline: Array<{ hour: string; count: number }>;
}

function invalidateCampaignQueries(queryClient: ReturnType<typeof useQueryClient>, campaignId?: string) {
  const prefixes: Array<readonly unknown[]> = [['campaigns']];

  if (campaignId) {
    prefixes.push(
      ['campaigns', campaignId],
      ['campaigns', campaignId, 'analytics'],
      ['campaigns', campaignId, 'messages']
    );
  }

  invalidateOrganizationScopedQueryPrefixes(queryClient, prefixes);
}

// List campaigns
export function useCampaigns(params: CampaignListParams = {}) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  const url = `${ENDPOINTS.CAMPAIGNS.BASE}${buildListQuery(params)}`;

  return useQuery<{ data: { campaigns: Campaign[] }; meta: PaginationMeta }>({
    queryKey: organizationQueryKey(['campaigns', params] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ campaigns: Campaign[] }>>(url);
      return { data: data.data, meta: data.meta! };
    },
    enabled: Boolean(userId && activeOrganization?.id),
  });
}

// Get single campaign
export function useCampaign(id: string | undefined) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  return useQuery<Campaign>({
    queryKey: organizationQueryKey(['campaigns', id] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ campaign: Campaign }>>(`${ENDPOINTS.CAMPAIGNS.BASE}/${id}`);
      return data.data.campaign;
    },
    enabled: Boolean(id && userId && activeOrganization?.id),
  });
}

// Get campaign analytics
export function useCampaignAnalytics(id: string | undefined) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  return useQuery<CampaignAnalytics>({
    queryKey: organizationQueryKey(['campaigns', id, 'analytics'] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ analytics: CampaignAnalytics }>>(`${ENDPOINTS.CAMPAIGNS.BASE}/${id}/analytics`);
      return data.data.analytics;
    },
    enabled: Boolean(id && userId && activeOrganization?.id),
  });
}

// Get campaign messages
export function useCampaignMessages(id: string | undefined, params: { page?: number; limit?: number; status?: string } = {}) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  const qs = buildListQuery(params);

  return useQuery<{ data: { messages: CampaignMessage[] }; meta: PaginationMeta }>({
    queryKey: organizationQueryKey(['campaigns', id, 'messages', params] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ messages: CampaignMessage[] }>>(`${ENDPOINTS.CAMPAIGNS.BASE}/${id}/messages${qs}`);
      return { data: data.data, meta: data.meta! };
    },
    enabled: Boolean(id && userId && activeOrganization?.id),
  });
}

// Create campaign
export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCampaignFormData) => {
      const { data } = await apiClient.post<ApiResponse<{ campaign: Campaign }>>(ENDPOINTS.CAMPAIGNS.BASE, body);
      return data.data.campaign;
    },
    onSuccess: (campaign) => invalidateCampaignQueries(qc, campaign?.id),
  });
}

// Update campaign
export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateCampaignFormData & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<{ campaign: Campaign }>>(`${ENDPOINTS.CAMPAIGNS.BASE}/${id}`, body);
      return data.data.campaign;
    },
    onSuccess: (campaign) => invalidateCampaignQueries(qc, campaign?.id),
  });
}

// Delete campaign
export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${ENDPOINTS.CAMPAIGNS.BASE}/${id}`);
    },
    onSuccess: (_data, id) => invalidateCampaignQueries(qc, id),
  });
}

// Campaign actions
function useCampaignAction(action: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<{ campaign: Campaign }>>(`${ENDPOINTS.CAMPAIGNS.BASE}/${id}/${action}`);
      return data.data.campaign;
    },
    onSuccess: (campaign, id) => invalidateCampaignQueries(qc, campaign?.id || id),
  });
}

export function useStartCampaign() { return useCampaignAction('start'); }
export function usePauseCampaign() { return useCampaignAction('pause'); }
export function useResumeCampaign() { return useCampaignAction('resume'); }
export function useCancelCampaign() { return useCampaignAction('cancel'); }
export function useRetryCampaign() { return useCampaignAction('retry'); }

export type { CampaignAnalytics };
