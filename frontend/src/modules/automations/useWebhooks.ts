import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import type { ApiResponse, PaginationMeta, Webhook } from '@/core/types';

interface WebhookListParams {
  page?: number;
  limit?: number;
}

interface WebhookListResponse {
  data: {
    webhooks: Webhook[];
  };
  meta: PaginationMeta;
}

interface WebhookPayload {
  name: string;
  url: string;
  events: string[];
  secret?: string;
  headers?: Record<string, string>;
  is_active?: boolean;
}

export function useWebhooks(params: WebhookListParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const queryString = query.toString();
  const url = `${ENDPOINTS.AUTOMATIONS.WEBHOOKS}${queryString ? `?${queryString}` : ''}`;

  return useQuery<WebhookListResponse>({
    queryKey: ['webhooks', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ webhooks: Webhook[] }>>(url);
      return {
        data: data.data,
        meta: data.meta!,
      };
    },
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: WebhookPayload) => {
      const { data } = await apiClient.post<ApiResponse<{ webhook: Webhook }>>(ENDPOINTS.AUTOMATIONS.WEBHOOKS, payload);
      return data.data.webhook;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: WebhookPayload & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<{ webhook: Webhook }>>(`${ENDPOINTS.AUTOMATIONS.WEBHOOKS}/${id}`, payload);
      return data.data.webhook;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${ENDPOINTS.AUTOMATIONS.WEBHOOKS}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<Record<string, unknown>>>(`${ENDPOINTS.AUTOMATIONS.WEBHOOKS}/${id}/test`);
      return data.data;
    },
  });
}
