import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { organizationQueryKey } from '@/core/queryKeys';
import type { RootState } from '@/core/store';
import type { Template, ApiResponse, MediaFile, PaginationMeta } from '@/core/types';
import type { CreateTemplateFormData, UpdateTemplateFormData } from './validations';
import { useOrganizationContext } from '@/modules/organizations/useOrganizationContext';
import { buildListQuery } from '@/shared/utils/listing';

interface TemplateListParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  type?: string;
  search?: string;
  waba_id?: string;
  wa_account_id?: string;
  date_from?: string;
  date_to?: string;
}

interface TemplateListResponse {
  data: { templates: Template[] };
  meta: PaginationMeta;
}

// List templates
export function useTemplates(params: TemplateListParams = {}) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  const url = `${ENDPOINTS.TEMPLATES.BASE}${buildListQuery(params)}`;

  return useQuery<TemplateListResponse>({
    queryKey: organizationQueryKey(['templates', params] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ templates: Template[] }>>(url);
      return { data: data.data, meta: data.meta! };
    },
    enabled: Boolean(userId && activeOrganization?.id),
  });
}

// Get single template
export function useTemplate(id: string | undefined) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  return useQuery<Template>({
    queryKey: organizationQueryKey(['templates', id] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ template: Template }>>(`${ENDPOINTS.TEMPLATES.BASE}/${id}`);
      return data.data.template;
    },
    enabled: Boolean(id && userId && activeOrganization?.id),
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
    mutationFn: async ({ id, wa_account_id }: { id: string; wa_account_id?: string }) => {
      const { data } = await apiClient.post<ApiResponse<{ template: Template }>>(
        `${ENDPOINTS.TEMPLATES.BASE}/${id}/publish`,
        wa_account_id ? { wa_account_id } : {}
      );
      return data.data.template;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

// Sync templates from Meta
export function useSyncTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (wa_account_id?: string) => {
      const payload = wa_account_id ? { wa_account_id } : {};
      const { data } = await apiClient.post<ApiResponse<{ synced: number; created: number; updated: number }>>(
        ENDPOINTS.TEMPLATES.SYNC,
        payload
      );
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
