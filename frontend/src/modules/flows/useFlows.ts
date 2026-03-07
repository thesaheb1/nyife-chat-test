import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import type {
  ApiResponse,
  FlowSubmission,
  PaginationMeta,
  WhatsAppFlow,
} from '@/core/types';

interface FlowListParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  waba_id?: string;
  category?: string;
}

interface FlowSubmissionParams {
  page?: number;
  limit?: number;
  screen_id?: string;
  contact_phone?: string;
}

export const flowQueryKeys = {
  all: ['flows'] as const,
  list: (params: FlowListParams) => ['flows', 'list', params] as const,
  detail: (id: string | undefined) => ['flows', 'detail', id] as const,
  submissions: (id: string | undefined, params: FlowSubmissionParams) => ['flows', 'submissions', id, params] as const,
};

function buildQueryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });
  const value = query.toString();
  return value ? `?${value}` : '';
}

export function useFlows(params: FlowListParams = {}) {
  const queryString = buildQueryString({
    page: params.page,
    limit: params.limit,
    status: params.status,
    search: params.search,
    waba_id: params.waba_id,
    category: params.category,
  });

  return useQuery({
    queryKey: flowQueryKeys.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ flows: WhatsAppFlow[] }>>(
        `${ENDPOINTS.FLOWS.BASE}${queryString}`
      );
      return {
        flows: data.data.flows,
        meta: data.meta as PaginationMeta,
      };
    },
  });
}

export function useFlow(id: string | undefined) {
  return useQuery({
    queryKey: flowQueryKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ flow: WhatsAppFlow }>>(
        `${ENDPOINTS.FLOWS.BASE}/${id}`
      );
      return data.data.flow;
    },
    enabled: !!id,
  });
}

export function useFlowSubmissions(id: string | undefined, params: FlowSubmissionParams = {}) {
  const queryString = buildQueryString({
    page: params.page,
    limit: params.limit,
    screen_id: params.screen_id,
    contact_phone: params.contact_phone,
  });

  return useQuery({
    queryKey: flowQueryKeys.submissions(id, params),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ submissions: FlowSubmission[] }>>(
        `${ENDPOINTS.FLOWS.BASE}/${id}/submissions${queryString}`
      );

      return {
        submissions: data.data.submissions,
        meta: data.meta as PaginationMeta,
      };
    },
    enabled: !!id,
  });
}

export function useCreateFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<WhatsAppFlow>) => {
      const { data } = await apiClient.post<ApiResponse<{ flow: WhatsAppFlow }>>(ENDPOINTS.FLOWS.BASE, body);
      return data.data.flow;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: flowQueryKeys.all });
    },
  });
}

export function useUpdateFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<WhatsAppFlow> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<{ flow: WhatsAppFlow }>>(
        `${ENDPOINTS.FLOWS.BASE}/${id}`,
        body
      );
      return data.data.flow;
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: flowQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: flowQueryKeys.detail(variables.id) }),
      ]);
    },
  });
}

export function useDeleteFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${ENDPOINTS.FLOWS.BASE}/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: flowQueryKeys.all });
    },
  });
}

export function useDuplicateFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<{ flow: WhatsAppFlow }>>(
        `${ENDPOINTS.FLOWS.BASE}/${id}/duplicate`
      );
      return data.data.flow;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: flowQueryKeys.all });
    },
  });
}

export function useSaveFlowToMeta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, waba_id }: { id: string; waba_id?: string }) => {
      const { data } = await apiClient.post<ApiResponse<{ flow: WhatsAppFlow }>>(
        `${ENDPOINTS.FLOWS.BASE}/${id}/save-to-meta`,
        { waba_id }
      );
      return data.data.flow;
    },
    onSuccess: async (flow) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: flowQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: flowQueryKeys.detail(flow.id) }),
      ]);
    },
  });
}

export function usePublishFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, waba_id }: { id: string; waba_id?: string }) => {
      const { data } = await apiClient.post<ApiResponse<{ flow: WhatsAppFlow }>>(
        `${ENDPOINTS.FLOWS.BASE}/${id}/publish`,
        { waba_id }
      );
      return data.data.flow;
    },
    onSuccess: async (flow) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: flowQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: flowQueryKeys.detail(flow.id) }),
      ]);
    },
  });
}

export function useDeprecateFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<{ flow: WhatsAppFlow }>>(
        `${ENDPOINTS.FLOWS.BASE}/${id}/deprecate`
      );
      return data.data.flow;
    },
    onSuccess: async (flow) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: flowQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: flowQueryKeys.detail(flow.id) }),
      ]);
    },
  });
}

export function useSyncFlows() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ waba_id, force }: { waba_id: string; force?: boolean }) => {
      const { data } = await apiClient.post<
        ApiResponse<{ synced: number; created: number; updated: number; conflicts: Array<Record<string, string>> }>
      >(ENDPOINTS.FLOWS.SYNC, { waba_id, force: Boolean(force) });
      return data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: flowQueryKeys.all });
    },
  });
}
