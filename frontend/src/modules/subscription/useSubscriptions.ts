import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import type {
  ApiResponse,
  CouponValidationResult,
  PaginationMeta,
  Plan,
  PlanDetailsResult,
  Subscription,
  SubscriptionCheckoutResult,
  SubscriptionHistoryResult,
  Wallet,
} from '@/core/types';

export const subscriptionQueryKeys = {
  all: ['subscription'] as const,
  plans: () => ['subscription', 'plans'] as const,
  planDetails: (slug: string | null) => ['subscription', 'plan', slug] as const,
  current: () => ['subscription', 'current'] as const,
  history: (page: number) => ['subscription', 'history', page] as const,
  walletBalance: () => ['wallet'] as const,
};

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: subscriptionQueryKeys.plans(),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ plans: Plan[] }>>(ENDPOINTS.SUBSCRIPTIONS.PLANS);
      return data.data.plans;
    },
  });
}

export function useSubscriptionPlanDetails(slug: string | null) {
  return useQuery({
    queryKey: subscriptionQueryKeys.planDetails(slug),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<PlanDetailsResult>>(ENDPOINTS.SUBSCRIPTIONS.PLAN_DETAILS(slug!));
      return data.data.plan;
    },
    enabled: !!slug,
  });
}

export function useCurrentSubscription() {
  return useQuery({
    queryKey: subscriptionQueryKeys.current(),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ subscription: Subscription | null }>>(ENDPOINTS.SUBSCRIPTIONS.CURRENT);
      return data.data.subscription;
    },
  });
}

export function useSubscriptionHistory(page: number) {
  return useQuery({
    queryKey: subscriptionQueryKeys.history(page),
    queryFn: async (): Promise<SubscriptionHistoryResult> => {
      const { data } = await apiClient.get<ApiResponse<{ subscriptions: Subscription[] }>>(
        `${ENDPOINTS.SUBSCRIPTIONS.HISTORY}?page=${page}&limit=10`
      );

      return {
        subscriptions: data.data.subscriptions,
        meta: data.meta as PaginationMeta,
      };
    },
  });
}

export function useSubscriptionWalletBalance() {
  return useQuery({
    queryKey: subscriptionQueryKeys.walletBalance(),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Wallet>>(ENDPOINTS.WALLET.BASE);
      return data.data;
    },
  });
}

export function useValidateCoupon() {
  return useMutation({
    mutationFn: async ({ code, planId }: { code: string; planId: string }) => {
      const { data } = await apiClient.post<ApiResponse<CouponValidationResult>>(ENDPOINTS.SUBSCRIPTIONS.VALIDATE_COUPON, {
        code,
        plan_id: planId,
      });

      return data.data;
    },
  });
}

export function useSubscribePlan() {
  return useMutation({
    mutationFn: async ({ planId, couponCode }: { planId: string; couponCode?: string }) => {
      const { data } = await apiClient.post<ApiResponse<SubscriptionCheckoutResult>>(ENDPOINTS.SUBSCRIPTIONS.SUBSCRIBE, {
        plan_id: planId,
        coupon_code: couponCode || undefined,
      });

      return data.data;
    },
  });
}

export function useChangePlan() {
  return useMutation({
    mutationFn: async ({ planId, couponCode }: { planId: string; couponCode?: string }) => {
      const { data } = await apiClient.post<ApiResponse<SubscriptionCheckoutResult>>(ENDPOINTS.SUBSCRIPTIONS.CHANGE_PLAN, {
        plan_id: planId,
        coupon_code: couponCode || undefined,
      });

      return data.data;
    },
  });
}

export function useVerifySubscriptionPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subscriptionId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    }: {
      subscriptionId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }) => {
      const { data } = await apiClient.post<ApiResponse<{ subscription: Subscription }>>(
        ENDPOINTS.SUBSCRIPTIONS.VERIFY_PAYMENT,
        {
          subscription_id: subscriptionId,
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: razorpaySignature,
        }
      );

      return data.data.subscription;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.current() }),
        queryClient.invalidateQueries({ queryKey: ['subscription', 'history'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reason?: string) => {
      const { data } = await apiClient.post<ApiResponse<{ subscription: Subscription }>>(ENDPOINTS.SUBSCRIPTIONS.CANCEL, {
        reason: reason || undefined,
      });

      return data.data.subscription;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.current() }),
        queryClient.invalidateQueries({ queryKey: ['subscription', 'history'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
}

export function useUpdateSubscriptionAutoRenew() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data } = await apiClient.patch<ApiResponse<{ subscription: Subscription }>>(
        ENDPOINTS.SUBSCRIPTIONS.AUTO_RENEW,
        { enabled }
      );

      return data.data.subscription;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.current() }),
        queryClient.invalidateQueries({ queryKey: ['subscription', 'history'] }),
      ]);
    },
  });
}
