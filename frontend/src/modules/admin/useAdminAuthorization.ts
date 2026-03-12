import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { ENDPOINTS } from '@/core/api/endpoints';
import { apiClient } from '@/core/api/client';
import type { ApiResponse, AdminAuthorization } from '@/core/types';
import type { RootState } from '@/core/store';

export const ADMIN_AUTHORIZATION_QUERY_KEY = ['admin', 'authorization'] as const;

export function useAdminAuthorization(enabled = true) {
  const user = useSelector((state: RootState) => state.auth.user);
  const shouldFetch = enabled && Boolean(user) && (user?.role === 'admin' || user?.role === 'super_admin');

  return useQuery<AdminAuthorization>({
    queryKey: ADMIN_AUTHORIZATION_QUERY_KEY,
    enabled: shouldFetch,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AdminAuthorization>>(ENDPOINTS.ADMIN.AUTHORIZATION);
      return data.data;
    },
  });
}
