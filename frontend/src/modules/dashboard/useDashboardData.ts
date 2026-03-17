import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { organizationQueryKey } from '@/core/queryKeys';
import type { DashboardData } from './types';

interface UseDashboardParams {
  dateFrom?: string;
  dateTo?: string;
  waAccountId?: string;
  userId?: string | null;
  organizationId?: string | null;
}

export function useDashboardData(params?: UseDashboardParams) {
  return useQuery({
    queryKey: organizationQueryKey(
      ['dashboard', params?.dateFrom, params?.dateTo, params?.waAccountId] as const,
      params?.userId,
      params?.organizationId
    ),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.dateFrom) searchParams.set('date_from', params.dateFrom);
      if (params?.dateTo) searchParams.set('date_to', params.dateTo);
      if (params?.waAccountId) searchParams.set('wa_account_id', params.waAccountId);
      const query = searchParams.toString();
      const url = `${ENDPOINTS.ANALYTICS.DASHBOARD}${query ? `?${query}` : ''}`;
      const { data } = await apiClient.get(url);
      return data.data as DashboardData;
    },
    enabled: Boolean(params?.userId && params?.organizationId),
  });
}

export function useUnreadChatsCount(waAccountId?: string, userId?: string | null, organizationId?: string | null) {
  return useQuery({
    queryKey: organizationQueryKey(['unreadChatsCount', waAccountId] as const, userId, organizationId),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        unread: 'true',
        limit: '1',
      });
      if (waAccountId) {
        searchParams.set('wa_account_id', waAccountId);
      }
      const { data } = await apiClient.get(
        `${ENDPOINTS.CHAT.CONVERSATIONS}?${searchParams.toString()}`
      );
      return (data.meta?.total ?? 0) as number;
    },
    staleTime: 15_000,
    enabled: Boolean(userId && organizationId),
  });
}
