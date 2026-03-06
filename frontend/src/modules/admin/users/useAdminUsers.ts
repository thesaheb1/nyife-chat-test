import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ADMIN_ENDPOINTS } from '../api';
import type { AdminUserDetail } from '../types';
import type { ApiResponse, PaginationMeta, Transaction, Subscription, Invoice } from '@/core/types';

interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export function useAdminUsers(params: ListUsersParams = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.search) sp.set('search', params.search);
  if (params.status) sp.set('status', params.status);
  const query = sp.toString();

  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `${ADMIN_ENDPOINTS.USERS.BASE}${query ? `?${query}` : ''}`
      );
      return data as ApiResponse<{ users: AdminUserDetail[] }> & { meta: PaginationMeta };
    },
  });
}

export function useAdminUser(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: async () => {
      const { data } = await apiClient.get(ADMIN_ENDPOINTS.USERS.DETAIL(id!));
      return data.data as AdminUserDetail;
    },
    enabled: !!id,
  });
}

export function useCreateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post(ADMIN_ENDPOINTS.USERS.BASE, body);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useUpdateUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await apiClient.put(ADMIN_ENDPOINTS.USERS.STATUS(id), { status });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'user'] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(ADMIN_ENDPOINTS.USERS.DETAIL(id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useCreditWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount, remarks }: { id: string; amount: number; remarks: string }) => {
      const { data } = await apiClient.post(ADMIN_ENDPOINTS.USERS.WALLET_CREDIT(id), { amount, remarks });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'user'] });
      qc.invalidateQueries({ queryKey: ['admin', 'user-transactions'] });
    },
  });
}

export function useDebitWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount, remarks }: { id: string; amount: number; remarks: string }) => {
      const { data } = await apiClient.post(ADMIN_ENDPOINTS.USERS.WALLET_DEBIT(id), { amount, remarks });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'user'] });
      qc.invalidateQueries({ queryKey: ['admin', 'user-transactions'] });
    },
  });
}

export function useUserTransactions(userId: string | undefined, page = 1) {
  return useQuery({
    queryKey: ['admin', 'user-transactions', userId, page],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `${ADMIN_ENDPOINTS.USERS.TRANSACTIONS(userId!)}?page=${page}&limit=10`
      );
      return data as ApiResponse<{ transactions: Transaction[] }> & { meta: PaginationMeta };
    },
    enabled: !!userId,
  });
}

export function useUserSubscriptions(userId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'user-subscriptions', userId],
    queryFn: async () => {
      const { data } = await apiClient.get(ADMIN_ENDPOINTS.USERS.SUBSCRIPTIONS(userId!));
      return data.data as { subscriptions: Subscription[] };
    },
    enabled: !!userId,
  });
}

export function useUserInvoices(userId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'user-invoices', userId],
    queryFn: async () => {
      const { data } = await apiClient.get(ADMIN_ENDPOINTS.USERS.INVOICES(userId!));
      return data.data as { invoices: Invoice[] };
    },
    enabled: !!userId,
  });
}
