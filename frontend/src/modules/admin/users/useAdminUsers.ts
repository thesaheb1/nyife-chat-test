import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ADMIN_ENDPOINTS } from '../api';
import type {
  AdminMetricsResult,
  AdminUserDashboard,
  AdminUserDetail,
  AdminUserInvitation,
  AdminUserInvoiceRecord,
  AdminUserListItem,
  AdminUserOrganization,
  AdminUserSubscriptionRecord,
  AdminUserSupportTicketsResult,
  AdminUserTeamMembersResult,
  AdminUserTransaction,
} from '../types';
import type { ApiResponse, PaginationMeta } from '@/core/types';

interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  plan?: string;
  date_from?: string;
  date_to?: string;
}

interface HistoryParams {
  page?: number;
  limit?: number;
  organization_id?: string;
}

interface InvitationParams {
  page?: number;
  limit?: number;
  enabled?: boolean;
}

interface UserSupportParams {
  userId?: string;
  page?: number;
  limit?: number;
  organizationId?: string;
  enabled?: boolean;
}

interface AnalyticsParams {
  userId?: string;
  date_from?: string;
  date_to?: string;
  enabled?: boolean;
}

const USER_ANALYTICS_METRICS = [
  'messages_sent',
  'messages_delivered',
  'messages_read',
  'messages_failed',
  'wallet_credits',
  'wallet_debits',
] as const;

function buildQuery(params: object) {
  const searchParams = new URLSearchParams();

  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function useAdminUsers(params: ListUsersParams = {}) {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `${ADMIN_ENDPOINTS.USERS.BASE}${buildQuery(params)}`
      );

      return data as ApiResponse<{ users: AdminUserListItem[] }> & { meta: PaginationMeta };
    },
  });
}

export function useAdminUser(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'user-detail', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AdminUserDetail>>(
        ADMIN_ENDPOINTS.USERS.DETAIL(id!)
      );

      return data.data;
    },
    enabled: Boolean(id),
  });
}

export function useAdminUserDashboard(userId: string | undefined, organizationId?: string) {
  return useQuery({
    queryKey: ['admin', 'user-dashboard', userId, organizationId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AdminUserDashboard>>(
        `${ADMIN_ENDPOINTS.USERS.DASHBOARD(userId!)}${buildQuery({
          organization_id: organizationId,
        })}`
      );

      return data.data;
    },
    enabled: Boolean(userId),
  });
}

export function useAdminUserInvitations(params: InvitationParams = {}) {
  const { enabled = true, page = 1, limit = 20 } = params;

  return useQuery({
    queryKey: ['admin', 'user-invitations', page, limit],
    enabled,
    queryFn: async () => {
      const { data } = await apiClient.get(
        `${ADMIN_ENDPOINTS.USERS.INVITATIONS.BASE}${buildQuery({ page, limit })}`
      );

      return data as ApiResponse<{ invitations: AdminUserInvitation[] }> & { meta: PaginationMeta };
    },
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
      password: string;
    }) => {
      const { data } = await apiClient.post<ApiResponse<AdminUserDetail>>(
        ADMIN_ENDPOINTS.USERS.BASE,
        body
      );

      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

export function useInviteAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
    }) => {
      const { data } = await apiClient.post<ApiResponse<AdminUserInvitation>>(
        ADMIN_ENDPOINTS.USERS.INVITATIONS.BASE,
        body
      );

      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-invitations'] });
    },
  });
}

export function useResendAdminUserInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { data } = await apiClient.post<ApiResponse<AdminUserInvitation>>(
        ADMIN_ENDPOINTS.USERS.INVITATIONS.RESEND(invitationId)
      );

      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-invitations'] });
    },
  });
}

export function useRevokeAdminUserInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { data } = await apiClient.post<ApiResponse<AdminUserInvitation>>(
        ADMIN_ENDPOINTS.USERS.INVITATIONS.REVOKE(invitationId)
      );

      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-invitations'] });
    },
  });
}

export function useDeleteAdminUserInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { data } = await apiClient.delete<ApiResponse<AdminUserInvitation>>(
        ADMIN_ENDPOINTS.USERS.INVITATIONS.DETAIL(invitationId)
      );

      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-invitations'] });
    },
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone?: string | null;
    }) => {
      const { data } = await apiClient.put<ApiResponse<AdminUserDetail>>(
        ADMIN_ENDPOINTS.USERS.DETAIL(id),
        body
      );

      return data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-dashboard', variables.id] });
    },
  });
}

export function useUploadAdminUserAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await apiClient.post<ApiResponse<{ avatar_url: string | null; file_id: string }>>(
        ADMIN_ENDPOINTS.USERS.AVATAR(id),
        formData
      );

      return data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-dashboard', variables.id] });
    },
  });
}

export function useRemoveAdminUserAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiResponse<{ avatar_url: null }>>(
        ADMIN_ENDPOINTS.USERS.AVATAR(id)
      );

      return data.data;
    },
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-detail', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-dashboard', userId] });
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await apiClient.put<ApiResponse<{ id: string; status: string }>>(
        ADMIN_ENDPOINTS.USERS.STATUS(id),
        { status }
      );

      return data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-dashboard', variables.id] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(ADMIN_ENDPOINTS.USERS.DETAIL(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-invitations'] });
    },
  });
}

export function useCreditWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      amount,
      remarks,
      organization_id,
    }: {
      id: string;
      amount: number;
      remarks: string;
      organization_id?: string;
    }) => {
      const { data } = await apiClient.post(ADMIN_ENDPOINTS.USERS.WALLET_CREDIT(id), {
        amount,
        remarks,
        organization_id,
      });

      return data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-dashboard', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-transactions', variables.id] });
    },
  });
}

export function useDebitWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      amount,
      remarks,
      organization_id,
    }: {
      id: string;
      amount: number;
      remarks: string;
      organization_id?: string;
    }) => {
      const { data } = await apiClient.post(ADMIN_ENDPOINTS.USERS.WALLET_DEBIT(id), {
        amount,
        remarks,
        organization_id,
      });

      return data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-dashboard', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'user-transactions', variables.id] });
    },
  });
}

export function useUserTransactions(userId: string | undefined, params: HistoryParams = {}) {
  const { page = 1, limit = 10, organization_id } = params;

  return useQuery({
    queryKey: ['admin', 'user-transactions', userId, page, limit, organization_id],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `${ADMIN_ENDPOINTS.USERS.TRANSACTIONS(userId!)}${buildQuery({
          page,
          limit,
          organization_id,
        })}`
      );

      return data as ApiResponse<{
        transactions: AdminUserTransaction[];
        organization: AdminUserOrganization | null;
      }> & { meta: PaginationMeta };
    },
    enabled: Boolean(userId),
  });
}

export function useUserSubscriptions(userId: string | undefined, params: HistoryParams = {}) {
  const { page = 1, limit = 10, organization_id } = params;

  return useQuery({
    queryKey: ['admin', 'user-subscriptions', userId, page, limit, organization_id],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `${ADMIN_ENDPOINTS.USERS.SUBSCRIPTIONS(userId!)}${buildQuery({
          page,
          limit,
          organization_id,
        })}`
      );

      return data as ApiResponse<{
        subscriptions: AdminUserSubscriptionRecord[];
        organization: AdminUserOrganization | null;
      }> & { meta: PaginationMeta };
    },
    enabled: Boolean(userId),
  });
}

export function useUserInvoices(userId: string | undefined, params: HistoryParams = {}) {
  const { page = 1, limit = 10, organization_id } = params;

  return useQuery({
    queryKey: ['admin', 'user-invoices', userId, page, limit, organization_id],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `${ADMIN_ENDPOINTS.USERS.INVOICES(userId!)}${buildQuery({
          page,
          limit,
          organization_id,
        })}`
      );

      return data as ApiResponse<{
        invoices: AdminUserInvoiceRecord[];
        organization: AdminUserOrganization | null;
      }> & { meta: PaginationMeta };
    },
    enabled: Boolean(userId),
  });
}

export function useUserTeamMembers(userId: string | undefined, params: HistoryParams = {}) {
  const { page = 1, limit = 10, organization_id } = params;

  return useQuery({
    queryKey: ['admin', 'user-team-members', userId, page, limit, organization_id],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `${ADMIN_ENDPOINTS.USERS.TEAM_MEMBERS(userId!)}${buildQuery({
          page,
          limit,
          organization_id,
        })}`
      );

      return data as ApiResponse<AdminUserTeamMembersResult> & { meta: PaginationMeta };
    },
    enabled: Boolean(userId),
  });
}

export function useAdminUserSupportTickets(params: UserSupportParams) {
  const {
    userId,
    page = 1,
    limit = 10,
    organizationId,
    enabled = true,
  } = params;

  return useQuery({
    queryKey: ['admin', 'user-support-tickets', userId, page, limit, organizationId],
    enabled: enabled && Boolean(userId),
    queryFn: async () => {
      const { data } = await apiClient.get(
        `${ADMIN_ENDPOINTS.SUPPORT.USER_TICKETS(userId!)}${buildQuery({
          page,
          limit,
          organization_id: organizationId,
        })}`
      );

      return data as ApiResponse<AdminUserSupportTicketsResult> & { meta: PaginationMeta };
    },
  });
}

export function useAdminUserAnalytics(params: AnalyticsParams) {
  const {
    userId,
    date_from,
    date_to,
    enabled = true,
  } = params;

  return useQuery({
    queryKey: ['admin', 'user-analytics', userId, date_from, date_to],
    enabled: enabled && Boolean(userId) && Boolean(date_from) && Boolean(date_to),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AdminMetricsResult>>(
        `${ADMIN_ENDPOINTS.METRICS}${buildQuery({
          metrics: USER_ANALYTICS_METRICS.join(','),
          date_from,
          date_to,
          user_id: userId,
        })}`
      );

      return data.data;
    },
  });
}
