import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ADMIN_ENDPOINTS } from '../api';
import type { AdminDashboardData } from '../types';
import type { ApiResponse } from '@/core/types';

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AdminDashboardData>>(
        ADMIN_ENDPOINTS.DASHBOARD
      );
      return data.data;
    },
  });
}
