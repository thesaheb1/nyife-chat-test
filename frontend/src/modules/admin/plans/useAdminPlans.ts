import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ADMIN_ENDPOINTS } from '../api';
import type { Plan, ApiResponse } from '@/core/types';
import type { Coupon } from '../types';

// ── Plans ──

export function useAdminPlans() {
  return useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: async () => {
      const { data } = await apiClient.get(ADMIN_ENDPOINTS.PLANS.BASE);
      return data.data as { plans: Plan[] };
    },
  });
}

export function useAdminPlan(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'plan', id],
    queryFn: async () => {
      const { data } = await apiClient.get(ADMIN_ENDPOINTS.PLANS.DETAIL(id!));
      return data.data as Plan;
    },
    enabled: !!id,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post(ADMIN_ENDPOINTS.PLANS.BASE, body);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  });
}

export function useUpdatePlan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.put(ADMIN_ENDPOINTS.PLANS.DETAIL(id), body);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
      qc.invalidateQueries({ queryKey: ['admin', 'plan', id] });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(ADMIN_ENDPOINTS.PLANS.DETAIL(id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  });
}

export function useUpdatePlanStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data } = await apiClient.put(ADMIN_ENDPOINTS.PLANS.STATUS(id), { is_active });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  });
}

// ── Coupons ──

export interface AdminCouponFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'inactive' | 'scheduled' | 'expired';
  discount_type?: 'percentage' | 'fixed';
}

export function useAdminCoupons(filters: AdminCouponFilters = {}) {
  return useQuery({
    queryKey: ['admin', 'coupons', filters],
    queryFn: async () => {
      const params = {
        page: filters.page ?? 1,
        limit: filters.limit ?? 20,
        search: filters.search || undefined,
        status: filters.status || undefined,
        discount_type: filters.discount_type || undefined,
      };
      const { data } = await apiClient.get<ApiResponse<{ coupons: Coupon[] }>>(
        ADMIN_ENDPOINTS.COUPONS.BASE,
        { params }
      );
      return data;
    },
  });
}

export function useAdminCoupon(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'coupon', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Coupon>>(ADMIN_ENDPOINTS.COUPONS.DETAIL(id!));
      return data.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post(ADMIN_ENDPOINTS.COUPONS.BASE, body);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  });
}

export function useUpdateCoupon(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.put(ADMIN_ENDPOINTS.COUPONS.DETAIL(id), body);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      qc.invalidateQueries({ queryKey: ['admin', 'coupon', id] });
    },
  });
}

export function useDeleteCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(ADMIN_ENDPOINTS.COUPONS.DETAIL(id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  });
}

export function useUpdateCouponStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data } = await apiClient.put(ADMIN_ENDPOINTS.COUPONS.STATUS(id), { is_active });
      return data.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      qc.invalidateQueries({ queryKey: ['admin', 'coupon', variables.id] });
    },
  });
}
