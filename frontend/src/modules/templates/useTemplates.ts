import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import type { Template, ApiResponse, MediaFile, PaginationMeta } from '@/core/types';
import type { CreateTemplateFormData, UpdateTemplateFormData } from './validations';

interface TemplateListParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  type?: string;
  search?: string;
  waba_id?: string;
}

interface TemplateListResponse {
  data: { templates: Template[] };
  meta: PaginationMeta;
}

// List templates
export function useTemplates(params: TemplateListParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.category) query.set('category', params.category);
  if (params.type) query.set('type', params.type);
  if (params.search) query.set('search', params.search);
  if (params.waba_id) query.set('waba_id', params.waba_id);

  const qs = query.toString();
  const url = `${ENDPOINTS.TEMPLATES.BASE}${qs ? `?${qs}` : ''}`;

  return useQuery<TemplateListResponse>({
    queryKey: ['templates', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ templates: Template[] }>>(url);
      return { data: data.data, meta: data.meta! };
    },
  });
}

// Get single template
export function useTemplate(id: string | undefined) {
  return useQuery<Template>({
    queryKey: ['templates', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ template: Template }>>(`${ENDPOINTS.TEMPLATES.BASE}/${id}`);
      return data.data.template;
    },
    enabled: !!id,
  });
}

// Create template
export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateTemplateFormData) => {
      const { data } = await apiClient.post<ApiResponse<{ template: Template }>>(ENDPOINTS.TEMPLATES.BASE, body);
      return data.data.template;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

// Update template
export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateTemplateFormData & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<{ template: Template }>>(`${ENDPOINTS.TEMPLATES.BASE}/${id}`, body);
      return data.data.template;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

// Delete template
export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${ENDPOINTS.TEMPLATES.BASE}/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

// Publish template to Meta
export function usePublishTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, waba_id }: { id: string; waba_id?: string }) => {
      const { data } = await apiClient.post<ApiResponse<{ template: Template }>>(`${ENDPOINTS.TEMPLATES.BASE}/${id}/publish`, { waba_id });
      return data.data.template;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

// Sync templates from Meta
export function useSyncTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (waba_id: string) => {
      const { data } = await apiClient.post<ApiResponse<{ synced: number; created: number; updated: number }>>(ENDPOINTS.TEMPLATES.SYNC, { waba_id });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useUploadTemplateMedia() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await apiClient.post<ApiResponse<MediaFile>>(ENDPOINTS.MEDIA.UPLOAD, formData);
      return data.data;
    },
  });
}
