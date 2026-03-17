import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { organizationQueryKey } from '@/core/queryKeys';
import type { RootState } from '@/core/store';
import type { ApiResponse, PaginationMeta, SupportThreadBootstrap, SupportTicket, TicketReply } from '@/core/types';

interface TicketListParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  unread?: boolean;
}

interface MessageListParams {
  limit?: number;
}

function buildQuery(params: object) {
  const query = new URLSearchParams();

  Object.entries(params as Record<string, string | number | boolean | undefined>).forEach(([key, value]) => {
    if (value === undefined || value === '' || value === null) {
      return;
    }

    query.set(key, String(value));
  });

  return query.toString();
}

export function useSupportUnreadCount(organizationId?: string | null, enabled = true) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useQuery({
    queryKey: organizationQueryKey(['support-unread'], userId, organizationId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ unread_count: number }>>(ENDPOINTS.SUPPORT.UNREAD_COUNT);
      return Number(data.data.unread_count || 0);
    },
    enabled: Boolean(enabled && userId && organizationId),
  });
}

export function useSupportTickets(params: TicketListParams, organizationId?: string | null) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useQuery({
    queryKey: organizationQueryKey(['support-tickets', params], userId, organizationId),
    queryFn: async () => {
      const query = buildQuery(params);
      const { data } = await apiClient.get<ApiResponse<{ tickets: SupportTicket[] }>>(
        `${ENDPOINTS.SUPPORT.TICKETS}${query ? `?${query}` : ''}`
      );

      return {
        tickets: data.data.tickets,
        meta: data.meta as PaginationMeta,
      };
    },
    enabled: Boolean(userId && organizationId),
  });
}

export function useSupportThread(ticketId?: string, organizationId?: string | null) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useQuery({
    queryKey: organizationQueryKey(['support-ticket', ticketId], userId, organizationId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SupportThreadBootstrap>>(
        ENDPOINTS.SUPPORT.TICKET_DETAIL(ticketId!)
      );
      return data.data;
    },
    enabled: Boolean(userId && organizationId && ticketId),
  });
}

export function useSupportInfiniteMessages(
  ticketId?: string,
  params: MessageListParams = {},
  organizationId?: string | null
) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const limit = params.limit ?? 30;

  return useInfiniteQuery({
    queryKey: organizationQueryKey(['support-messages', ticketId], userId, organizationId),
    queryFn: async ({ pageParam }) => {
      const query = buildQuery({ page: pageParam, limit });
      const { data } = await apiClient.get<ApiResponse<{ messages: TicketReply[] }>>(
        `${ENDPOINTS.SUPPORT.TICKET_MESSAGES(ticketId!)}${query ? `?${query}` : ''}`
      );

      return {
        messages: data.data.messages,
        meta: data.meta as PaginationMeta,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (
      lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined
    ),
    enabled: Boolean(userId && organizationId && ticketId),
  });
}

export function useCreateSupportTicket(organizationId?: string | null) {
  const queryClient = useQueryClient();
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useMutation({
    mutationFn: async (payload: {
      subject: string;
      description: string;
      category: string;
      priority: string;
    }) => {
      const { data } = await apiClient.post<ApiResponse<SupportThreadBootstrap>>(
        ENDPOINTS.SUPPORT.TICKETS,
        payload
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationQueryKey(['support-tickets'], userId, organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: organizationQueryKey(['support-unread'], userId, organizationId),
      });
    },
  });
}

export function useReplyToSupportTicket(ticketId?: string, organizationId?: string | null) {
  const queryClient = useQueryClient();
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useMutation({
    mutationFn: async (payload: { body: string }) => {
      const { data } = await apiClient.post<ApiResponse<{ reply: TicketReply; ticket: SupportTicket }>>(
        `${ENDPOINTS.SUPPORT.TICKETS}/${ticketId}/reply`,
        payload
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationQueryKey(['support-ticket', ticketId], userId, organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: organizationQueryKey(['support-messages', ticketId], userId, organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: organizationQueryKey(['support-tickets'], userId, organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: organizationQueryKey(['support-unread'], userId, organizationId),
      });
    },
  });
}

export function useCloseSupportTicket(ticketId?: string, organizationId?: string | null) {
  const queryClient = useQueryClient();
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.put<ApiResponse<{ ticket: SupportTicket }>>(
        `${ENDPOINTS.SUPPORT.TICKETS}/${ticketId}/close`
      );
      return data.data.ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationQueryKey(['support-ticket', ticketId], userId, organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: organizationQueryKey(['support-tickets'], userId, organizationId),
      });
    },
  });
}

export function useRateSupportTicket(ticketId?: string, organizationId?: string | null) {
  const queryClient = useQueryClient();
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useMutation({
    mutationFn: async (payload: { satisfaction_rating: number; satisfaction_feedback?: string }) => {
      const { data } = await apiClient.put<ApiResponse<{ ticket: SupportTicket }>>(
        `${ENDPOINTS.SUPPORT.TICKETS}/${ticketId}/rate`,
        payload
      );
      return data.data.ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationQueryKey(['support-ticket', ticketId], userId, organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: organizationQueryKey(['support-tickets'], userId, organizationId),
      });
    },
  });
}

export function useMarkSupportTicketRead(ticketId?: string, organizationId?: string | null) {
  const queryClient = useQueryClient();
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useMutation({
    mutationFn: async () => {
      if (!ticketId) {
        return null;
      }

      const { data } = await apiClient.post<ApiResponse<{ unread_count: number }>>(
        ENDPOINTS.SUPPORT.TICKET_READ(ticketId)
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationQueryKey(['support-ticket', ticketId], userId, organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: organizationQueryKey(['support-tickets'], userId, organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: organizationQueryKey(['support-unread'], userId, organizationId),
      });
    },
  });
}
