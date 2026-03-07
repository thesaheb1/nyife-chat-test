import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ADMIN_ENDPOINTS } from '../api';
import type { SupportTicket, TicketReply, ApiResponse, PaginationMeta } from '@/core/types';

interface ListTicketsParams {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
}

export function useAdminTickets(params: ListTicketsParams = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.status) sp.set('status', params.status);
  if (params.priority) sp.set('priority', params.priority);
  const query = sp.toString();

  return useQuery({
    queryKey: ['admin', 'tickets', params],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `${ADMIN_ENDPOINTS.SUPPORT.TICKETS}${query ? `?${query}` : ''}`
      );
      return data as ApiResponse<{ tickets: SupportTicket[] }> & { meta: PaginationMeta };
    },
  });
}

export function useAdminTicket(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'ticket', id],
    queryFn: async () => {
      const { data } = await apiClient.get(ADMIN_ENDPOINTS.SUPPORT.TICKET_DETAIL(id!));
      return data.data as { ticket: SupportTicket; replies: TicketReply[] };
    },
    enabled: !!id,
  });
}

export function useReplyToTicket(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { data } = await apiClient.post(ADMIN_ENDPOINTS.SUPPORT.TICKET_REPLY(ticketId), { body });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ticket', ticketId] }),
  });
}

export function useUpdateTicketStatus(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (status: string) => {
      const { data } = await apiClient.put(ADMIN_ENDPOINTS.SUPPORT.TICKET_STATUS(ticketId), { status });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'ticket', ticketId] });
      qc.invalidateQueries({ queryKey: ['admin', 'tickets'] });
    },
  });
}

export function useAssignTicket(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignedTo: string) => {
      const { data } = await apiClient.put(ADMIN_ENDPOINTS.SUPPORT.TICKET_ASSIGN(ticketId), { admin_user_id: assignedTo });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ticket', ticketId] }),
  });
}
