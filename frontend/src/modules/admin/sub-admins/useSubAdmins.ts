import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ADMIN_ENDPOINTS } from '../api';
import type { SubAdmin, AdminRole } from '../types';
import type { ApiResponse } from '@/core/types';

// ── Sub-Admins ──

export function useSubAdmins() {
  return useQuery({
    queryKey: ['admin', 'sub-admins'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ sub_admins: SubAdmin[] }>>(
        ADMIN_ENDPOINTS.SUB_ADMINS.BASE
      );
      return data.data.sub_admins;
    },
  });
}

export function useCreateSubAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { user_id: string; role_id: string }) => {
      const { data } = await apiClient.post(ADMIN_ENDPOINTS.SUB_ADMINS.BASE, body);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'sub-admins'] }),
  });
}

export function useUpdateSubAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; role_id?: string; status?: string }) => {
      const { data } = await apiClient.put(ADMIN_ENDPOINTS.SUB_ADMINS.DETAIL(id), body);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'sub-admins'] }),
  });
}

export function useDeleteSubAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(ADMIN_ENDPOINTS.SUB_ADMINS.DETAIL(id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'sub-admins'] }),
  });
}

// ── Roles ──

export function useRoles() {
  return useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ roles: AdminRole[] }>>(
        ADMIN_ENDPOINTS.ROLES.BASE
      );
      return data.data.roles;
    },
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string; permissions: Record<string, unknown> }) => {
      const { data } = await apiClient.post(ADMIN_ENDPOINTS.ROLES.BASE, body);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; title?: string; permissions?: Record<string, unknown> }) => {
      const { data } = await apiClient.put(ADMIN_ENDPOINTS.ROLES.DETAIL(id), body);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(ADMIN_ENDPOINTS.ROLES.DETAIL(id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  });
}
