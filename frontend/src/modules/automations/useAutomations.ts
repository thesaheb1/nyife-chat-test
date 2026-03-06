import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import type { Automation, AutomationLog, ApiResponse, PaginationMeta } from '@/core/types';

interface AutomationListParams {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  search?: string;
}

export function useAutomations(params: AutomationListParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.type) query.set('type', params.type);
  if (params.search) query.set('search', params.search);
  const qs = query.toString();

  return useQuery<{ data: { automations: Automation[] }; meta: PaginationMeta }>({
    queryKey: ['automations', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ automations: Automation[] }>>(`${ENDPOINTS.AUTOMATIONS.BASE}${qs ? `?${qs}` : ''}`);
      return { data: data.data, meta: data.meta! };
    },
  });
}

export function useAutomation(id: string | undefined) {
  return useQuery<Automation>({
    queryKey: ['automations', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ automation: Automation }>>(`${ENDPOINTS.AUTOMATIONS.BASE}/${id}`);
      return data.data.automation;
    },
    enabled: !!id,
  });
}

export function useAutomationLogs(id: string | undefined, page = 1) {
  return useQuery<{ data: { logs: AutomationLog[] }; meta: PaginationMeta }>({
    queryKey: ['automations', id, 'logs', page],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ logs: AutomationLog[] }>>(`${ENDPOINTS.AUTOMATIONS.BASE}/${id}/logs?page=${page}&limit=20`);
      return { data: data.data, meta: data.meta! };
    },
    enabled: !!id,
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
