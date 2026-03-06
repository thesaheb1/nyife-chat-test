import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ADMIN_ENDPOINTS } from '../api';
import type { AdminSetting } from '../types';
import type { ApiResponse } from '@/core/types';

export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ settings: AdminSetting[] }>>(
        ADMIN_ENDPOINTS.SETTINGS.BASE
      );
      return data.data.settings;
    },
  });
}

export function useAdminSettingsByGroup(group: string) {
  return useQuery({
    queryKey: ['admin', 'settings', group],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ settings: AdminSetting[] }>>(
        ADMIN_ENDPOINTS.SETTINGS.GROUP(group)
      );
      return data.data.settings;
    },
    enabled: !!group,
  });
}

export function useUpdateAdminSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { settings: Array<{ key: string; value: string }> }) => {
      const { data } = await apiClient.put(ADMIN_ENDPOINTS.SETTINGS.BASE, body);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  });
}

export function useUpdateAdminSettingsByGroup(group: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { settings: Array<{ key: string; value: string }> }) => {
      const { data } = await apiClient.put(ADMIN_ENDPOINTS.SETTINGS.GROUP(group), body);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      qc.invalidateQueries({ queryKey: ['admin', 'settings', group] });
    },
  });
}
