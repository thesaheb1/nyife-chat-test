import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ADMIN_ENDPOINTS } from '../api';
import type { BroadcastNotification } from '../types';
import type { ApiResponse } from '@/core/types';

export function useAdminNotifications() {
  return useQuery({
    queryKey: ['admin', 'notifications'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ notifications: BroadcastNotification[] }>>(
        ADMIN_ENDPOINTS.NOTIFICATIONS.BASE
      );
      return data.data.notifications;
    },
  });
}

export function useSendNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      title: string;
      body: string;
      target_type: 'all' | 'specific_users';
      target_user_ids?: string[];
      send_email?: boolean;
    }) => {
      const { data } = await apiClient.post(ADMIN_ENDPOINTS.NOTIFICATIONS.BASE, body);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'notifications'] }),
  });
}
