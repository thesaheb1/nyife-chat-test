import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';

interface PublicSettings {
  google_oauth_enabled?: boolean;
  facebook_oauth_enabled?: boolean;
  app_name?: string;
  [key: string]: unknown;
}

export function usePublicSettings() {
  return useQuery({
    queryKey: ['publicSettings'],
    queryFn: async () => {
      const { data } = await apiClient.get(ENDPOINTS.SETTINGS.PUBLIC);
      return data.data as PublicSettings;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}
