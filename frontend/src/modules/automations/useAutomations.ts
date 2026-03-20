import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { organizationQueryKey } from '@/core/queryKeys';
import type { RootState } from '@/core/store';
import type { Automation, AutomationLog, ApiResponse, PaginationMeta } from '@/core/types';
import { useOrganizationContext } from '@/modules/organizations/useOrganizationContext';
import { buildListQuery } from '@/shared/utils/listing';

interface AutomationListParams {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}

export function useAutomations(params: AutomationListParams = {}) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  const qs = buildListQuery(params);

  return useQuery<{ data: { automations: Automation[] }; meta: PaginationMeta }>({
    queryKey: organizationQueryKey(['automations', params] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ automations: Automation[] }>>(`${ENDPOINTS.AUTOMATIONS.BASE}${qs}`);
      return { data: data.data, meta: data.meta! };
    },
    enabled: Boolean(userId && activeOrganization?.id),
  });
}

export function useAutomation(id: string | undefined) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  return useQuery<Automation>({
    queryKey: organizationQueryKey(['automations', id] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ automation: Automation }>>(`${ENDPOINTS.AUTOMATIONS.BASE}/${id}`);
      return data.data.automation;
    },
    enabled: Boolean(id && userId && activeOrganization?.id),
  });
}

export function useAutomationLogs(id: string | undefined, page = 1) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  return useQuery<{ data: { logs: AutomationLog[] }; meta: PaginationMeta }>({
    queryKey: organizationQueryKey(['automations', id, 'logs', page] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ logs: AutomationLog[] }>>(`${ENDPOINTS.AUTOMATIONS.BASE}/${id}/logs?page=${page}&limit=20`);
      return { data: data.data, meta: data.meta! };
    },
    enabled: Boolean(id && userId && activeOrganization?.id),
  });
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<{ automation: Automation }>>(ENDPOINTS.AUTOMATIONS.BASE, body);
      return data.data.automation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  });
}

export function useUpdateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put<ApiResponse<{ automation: Automation }>>(`${ENDPOINTS.AUTOMATIONS.BASE}/${id}`, body);
      return data.data.automation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  });
}

export function useUpdateAutomationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await apiClient.put<ApiResponse<{ automation: Automation }>>(`${ENDPOINTS.AUTOMATIONS.BASE}/${id}/status`, { status });
      return data.data.automation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${ENDPOINTS.AUTOMATIONS.BASE}/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
  });
}
