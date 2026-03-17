import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { apiClient } from '@/core/api/client';
import { sessionQueryKey } from '@/core/queryKeys';
import type { RootState } from '@/core/store';
import type { ApiResponse, PaginationMeta, SupportThreadBootstrap, SupportTicket, TicketReply } from '@/core/types';
import { ADMIN_ENDPOINTS } from '../api';

interface AdminTicketListParams {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  search?: string;
  assigned_to?: string;
  unread?: boolean;
}

interface MessageListParams {
  limit?: number;
}

export interface AssignableAdmin {
  user_id: string;
  role_id: string;
  role_title: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: string | null;
  last_login_at: string | null;
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

export function useAdminSupportUnreadCount(enabled = true) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useQuery({
    queryKey: sessionQueryKey(['admin-support-unread'], userId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ unread_count: number }>>(
        ADMIN_ENDPOINTS.SUPPORT.UNREAD_COUNT
      );
      return Number(data.data.unread_count || 0);
    },
    enabled: Boolean(enabled && userId),
  });
}

export function useAdminTickets(params: AdminTicketListParams = {}) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useQuery({
    queryKey: sessionQueryKey(['admin-support-tickets', params], userId),
    queryFn: async () => {
      const query = buildQuery(params);
      const { data } = await apiClient.get<ApiResponse<{ tickets: SupportTicket[] }>>(
        `${ADMIN_ENDPOINTS.SUPPORT.TICKETS}${query ? `?${query}` : ''}`
      );
      return {
        tickets: data.data.tickets,
        meta: data.meta as PaginationMeta,
      };
    },
    enabled: Boolean(userId),
  });
}

export function useAdminTicket(ticketId?: string) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useQuery({
    queryKey: sessionQueryKey(['admin-support-ticket', ticketId], userId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SupportThreadBootstrap>>(
        ADMIN_ENDPOINTS.SUPPORT.TICKET_DETAIL(ticketId!)
      );
      return data.data;
    },
    enabled: Boolean(userId && ticketId),
  });
}

export function useAdminTicketInfiniteMessages(ticketId?: string, params: MessageListParams = {}) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const limit = params.limit ?? 30;

  return useInfiniteQuery({
    queryKey: sessionQueryKey(['admin-support-messages', ticketId], userId),
    queryFn: async ({ pageParam }) => {
      const query = buildQuery({ page: pageParam, limit });
      const { data } = await apiClient.get<ApiResponse<{ messages: TicketReply[] }>>(
        `${ADMIN_ENDPOINTS.SUPPORT.TICKET_MESSAGES(ticketId!)}${query ? `?${query}` : ''}`
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
    enabled: Boolean(userId && ticketId),
  });
}

export function useAssignableAdmins() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useQuery({
    queryKey: sessionQueryKey(['admin-support-assignable'], userId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ admins: AssignableAdmin[] }>>(
        ADMIN_ENDPOINTS.SUPPORT.ASSIGNABLE_ADMINS
      );
      return data.data.admins;
    },
    enabled: Boolean(userId),
  });
}

export function useReplyToTicket(ticketId?: string) {
  const queryClient = useQueryClient();
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useMutation({
    mutationFn: async (body: string) => {
      const { data } = await apiClient.post<ApiResponse<{ reply: TicketReply; ticket: SupportTicket }>>(
        ADMIN_ENDPOINTS.SUPPORT.TICKET_REPLY(ticketId!),
        { body }
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(['admin-support-ticket', ticketId], userId) });
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(['admin-support-messages', ticketId], userId) });
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(['admin-support-tickets'], userId) });
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(['admin-support-unread'], userId) });
    },
  });
}

export function useUpdateTicketStatus(ticketId?: string) {
  const queryClient = useQueryClient();
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useMutation({
    mutationFn: async (status: string) => {
      const { data } = await apiClient.put<ApiResponse<{ ticket: SupportTicket }>>(
        ADMIN_ENDPOINTS.SUPPORT.TICKET_STATUS(ticketId!),
        { status }
      );
      return data.data.ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(['admin-support-ticket', ticketId], userId) });
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(['admin-support-tickets'], userId) });
    },
  });
}

export function useAssignTicket(ticketId?: string) {
  const queryClient = useQueryClient();
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useMutation({
    mutationFn: async (assignedTo: string) => {
      const { data } = await apiClient.put<ApiResponse<{ ticket: SupportTicket }>>(
        ADMIN_ENDPOINTS.SUPPORT.TICKET_ASSIGN(ticketId!),
        { admin_user_id: assignedTo }
      );
      return data.data.ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(['admin-support-ticket', ticketId], userId) });
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(['admin-support-tickets'], userId) });
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(['admin-support-unread'], userId) });
    },
  });
}

export function useDeleteTicket(ticketId?: string) {
  const queryClient = useQueryClient();
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useMutation({
    mutationFn: async () => {
      await apiClient.delete(ADMIN_ENDPOINTS.SUPPORT.TICKET_DELETE(ticketId!));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(['admin-support-ticket', ticketId], userId) });
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(['admin-support-tickets'], userId) });
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(['admin-support-unread'], userId) });
    },
  });
}

export function useMarkAdminTicketRead(ticketId?: string) {
  const queryClient = useQueryClient();
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiResponse<{ unread_count: number }>>(
        ADMIN_ENDPOINTS.SUPPORT.TICKET_READ(ticketId!)
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(['admin-support-ticket', ticketId], userId) });
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(['admin-support-tickets'], userId) });
      queryClient.invalidateQueries({ queryKey: sessionQueryKey(['admin-support-unread'], userId) });
    },
  });
}
