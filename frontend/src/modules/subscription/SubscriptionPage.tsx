import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, CreditCard } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import type { ApiResponse, Plan, Subscription } from '@/core/types';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function usePlans() {
  return useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ plans: Plan[] }>>(ENDPOINTS.SUBSCRIPTIONS.PLANS);
      return data.data.plans;
    },
  });
}

function useCurrentSubscription() {
  return useQuery<Subscription | null>({
    queryKey: ['current-subscription'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ subscription: Subscription | null }>>(ENDPOINTS.SUBSCRIPTIONS.CURRENT);
      return data.data.subscription;
    },
  });
}

export function SubscriptionPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: plans, isLoading: plansLoading } = usePlans();
  const { data: current, isLoading: subLoading } = useCurrentSubscription();
  const [couponOpen, setCouponOpen] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  const validateCoupon = useMutation({
    mutationFn: async (code: string) => {
      const { data } = await apiClient.post<ApiResponse<{ valid: boolean; discount_percent: number }>>(ENDPOINTS.SUBSCRIPTIONS.VALIDATE_COUPON, { code });
      return data.data;
    },
  });

  const handleSubscribe = async (plan: Plan) => {
    setSelectedPlanId(plan.id);
    setSubscribing(true);
    try {
      const { data } = await apiClient.post<ApiResponse<{ order_id: string; amount: number; currency: string; key: string }>>(
        ENDPOINTS.SUBSCRIPTIONS.SUBSCRIBE,
        { plan_id: plan.id, coupon_code: coupon || undefined }
      );
      const order = data.data;

      const rzp = new window.Razorpay({
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: 'Nyife',
        description: `${plan.name} Plan`,
        order_id: order.order_id,
        handler: async (response: Record<string, string>) => {
          try {
            await apiClient.post(ENDPOINTS.SUBSCRIPTIONS.VERIFY_PAYMENT, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success('Subscription activated!');
            qc.invalidateQueries({ queryKey: ['current-subscription'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
          } catch {
            toast.error('Payment verification failed');
          }
        },
        theme: { color: '#10B981' },
      });
      rzp.open();
    } catch (err) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to initiate payment');
    }
    setSubscribing(false);
    setSelectedPlanId(null);
  };

  const cancelSub = useMutation({
    mutationFn: async () => { await apiClient.post(ENDPOINTS.SUBSCRIPTIONS.CANCEL); },
    onSuccess: () => { toast.success('Subscription cancelled'); qc.invalidateQueries({ queryKey: ['current-subscription'] }); },
    onError: () => { toast.error('Failed to cancel subscription'); },
  });

  const isLoading = plansLoading || subLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80" />)}
        </div>
      </div>
    );
  }

  const formatPrice = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('subscription.title')}</h1>
          {current && (
            <p className="text-sm text-muted-foreground">
              {t('subscription.currentPlan')}: <span className="font-medium">{current.plan?.name}</span>
              {' — '}
              <Badge variant={current.status === 'active' ? 'default' : 'secondary'} className="text-xs capitalize">{current.status}</Badge>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCouponOpen(true)}>
            <CreditCard className="mr-2 h-4 w-4" />Have a coupon?
          </Button>
          {current?.status === 'active' && (
            <Button variant="outline" size="sm" onClick={() => cancelSub.mutate()} disabled={cancelSub.isPending}>
              {t('subscription.cancelSubscription')}
            </Button>
          )}
        </div>
      </div>

      {coupon && validateCoupon.data?.valid && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          Coupon "{coupon}" applied — {validateCoupon.data.discount_percent}% off!
        </div>
      )}

      {plans && plans.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">{t('subscription.noPlans')}</p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans?.map((plan) => {
          const isCurrent = current?.plan_id === plan.id && current?.status === 'active';
          return (
            <Card key={plan.id} className={`relative ${isCurrent ? 'border-primary ring-1 ring-primary' : ''}`}>
              {isCurrent && (
                <Badge className="absolute -top-2 right-4 text-[10px]">Current</Badge>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div>
                  <span className="text-3xl font-bold">{formatPrice(plan.price)}</span>
                  <span className="text-sm text-muted-foreground">/{plan.type === 'yearly' ? 'year' : plan.type === 'lifetime' ? 'once' : 'month'}</span>
                </div>
                {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" />{plan.max_contacts.toLocaleString()} contacts</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" />{plan.max_templates.toLocaleString()} templates</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" />{plan.max_campaigns_per_month.toLocaleString()} campaigns/month</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" />{plan.max_messages_per_month.toLocaleString()} messages/month</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" />{plan.max_team_members} team members</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" />{plan.max_whatsapp_numbers} WhatsApp numbers</li>
                  {plan.has_priority_support && (
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" />Priority support</li>
                  )}
                </ul>
                <Button
                  className="w-full"
                  disabled={isCurrent || (subscribing && selectedPlanId === plan.id)}
                  onClick={() => handleSubscribe(plan)}
                >
                  {subscribing && selectedPlanId === plan.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isCurrent ? 'Current Plan' : t('subscription.subscribe')}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Coupon Dialog */}
      <Dialog open={couponOpen} onOpenChange={setCouponOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Apply Coupon</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Coupon Code</Label>
              <Input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="SAVE20" />
            </div>
            {validateCoupon.data && (
              <p className={`text-sm ${validateCoupon.data.valid ? 'text-green-600' : 'text-destructive'}`}>
                {validateCoupon.data.valid ? `Valid! ${validateCoupon.data.discount_percent}% discount` : 'Invalid coupon code'}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCouponOpen(false)}>Close</Button>
              <Button
                onClick={() => validateCoupon.mutate(coupon)}
                disabled={!coupon || validateCoupon.isPending}
              >
                {validateCoupon.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Validate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
