import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  ArrowRight,
  CreditCard,
  History,
  Info,
  Loader2,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CouponValidationResult, Plan, Subscription } from '@/core/types';
import { formatCurrency, formatDate } from '@/shared/utils/formatters';
import { DataTable } from '@/shared/components/DataTable';
import { PlanCard, PlanDetailsSheet } from './SubscriptionComponents';
import {
  subscriptionQueryKeys,
  useCancelSubscription,
  useChangePlan,
  useCurrentSubscription,
  useSubscriptionHistory,
  useSubscriptionPlans,
  useSubscribePlan,
  useValidateCoupon,
  useVerifySubscriptionPayment,
} from './useSubscriptions';
import {
  type CheckoutMode,
  formatLimit,
  getCheckoutSummary,
  getPaymentError,
  getPlanHighlights,
  getStatusVariant,
  getUsageMetrics,
  humanizeKey,
} from './subscriptionUtils';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type ActiveTab = 'overview' | 'plans' | 'history';

export function SubscriptionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const { data: current, isLoading: currentLoading } = useCurrentSubscription();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [historyPage, setHistoryPage] = useState(1);
  const { data: historyData, isLoading: historyLoading } = useSubscriptionHistory(historyPage);
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>('subscribe');
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const validateCoupon = useValidateCoupon();
  const subscribePlan = useSubscribePlan();
  const changePlan = useChangePlan();
  const verifyPayment = useVerifySubscriptionPayment();
  const cancelSubscription = useCancelSubscription();

  const isLoading = plansLoading || currentLoading;
  const checkoutBusy = validateCoupon.isPending || subscribePlan.isPending || changePlan.isPending || verifyPayment.isPending;
  const summary = getCheckoutSummary(checkoutPlan, couponResult);
  const selectedPlanFeatures = checkoutPlan ? getPlanHighlights(checkoutPlan) : [];

  const historyColumns = useMemo<ColumnDef<Subscription, unknown>[]>(() => [
    {
      id: 'plan',
      header: 'Plan',
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="font-medium">{row.original.plan?.name || 'Unknown plan'}</p>
          <p className="text-xs text-muted-foreground">{row.original.plan?.slug || row.original.plan_id}</p>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.status)} className="capitalize">
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'amount_paid',
      header: 'Amount',
      cell: ({ row }) => formatCurrency(row.original.amount_paid, row.original.plan?.currency || 'INR'),
    },
    {
      id: 'discount',
      header: 'Discount',
      cell: ({ row }) => row.original.discount_amount ? formatCurrency(row.original.discount_amount, row.original.plan?.currency || 'INR') : '-',
    },
    {
      accessorKey: 'starts_at',
      header: 'Started',
      cell: ({ row }) => formatDate(row.original.starts_at, { dateStyle: 'medium' }),
    },
    {
      accessorKey: 'expires_at',
      header: 'Ends',
      cell: ({ row }) => row.original.expires_at ? formatDate(row.original.expires_at, { dateStyle: 'medium' }) : 'Lifetime',
    },
  ], []);

  const refreshSubscriptionState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.current() }),
      queryClient.invalidateQueries({ queryKey: ['subscription', 'history'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  };

  const closeCheckout = () => {
    setCheckoutPlan(null);
    setCouponCode('');
    setCouponResult(null);
    setCouponError(null);
  };

  const openCheckout = (plan: Plan) => {
    const nextMode: CheckoutMode = current?.status === 'active' && current.plan_id !== plan.id ? 'change' : 'subscribe';
    setCheckoutMode(nextMode);
    setCheckoutPlan(plan);
    setCouponCode('');
    setCouponResult(null);
    setCouponError(null);
  };

  const applyCoupon = async () => {
    if (!checkoutPlan || !couponCode.trim()) {
      setCouponError('Enter a coupon code first.');
      return;
    }

    try {
      const result = await validateCoupon.mutateAsync({ code: couponCode.trim(), planId: checkoutPlan.id });
      setCouponResult(result);
      setCouponError(null);
      toast.success(`Coupon ${result.code} applied.`);
    } catch (error) {
      setCouponResult(null);
      setCouponError(getPaymentError(error, 'Unable to validate coupon.'));
    }
  };

  const startCheckout = async () => {
    if (!checkoutPlan) {
      return;
    }

    try {
      const checkoutMutation = checkoutMode === 'change' ? changePlan : subscribePlan;
      const result = await checkoutMutation.mutateAsync({
        planId: checkoutPlan.id,
        couponCode: couponResult?.code || couponCode.trim() || undefined,
      });

      if (!result.payment_required) {
        await refreshSubscriptionState();
        toast.success(checkoutMode === 'change' ? 'Plan changed successfully.' : 'Subscription activated successfully.');
        setActiveTab('overview');
        closeCheckout();
        return;
      }

      if (!window.Razorpay || !result.razorpay_order) {
        toast.error('Razorpay checkout is unavailable. Reload the page and try again.');
        return;
      }

      const razorpay = new window.Razorpay({
        key: result.razorpay_order.key_id,
        amount: result.razorpay_order.amount,
        currency: result.razorpay_order.currency,
        name: 'Nyife',
        description: `${result.plan.name} plan`,
        order_id: result.razorpay_order.id,
        handler: async (response: Record<string, string>) => {
          try {
            await verifyPayment.mutateAsync({
              subscriptionId: result.subscription.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success(checkoutMode === 'change' ? 'Plan changed successfully.' : 'Subscription activated successfully.');
            setActiveTab('overview');
            closeCheckout();
          } catch (error) {
            toast.error(getPaymentError(error, 'Payment verification failed.'));
          }
        },
        modal: {
          ondismiss: () => {
            toast.error('Payment was cancelled before completion.');
          },
        },
        theme: { color: '#0f766e' },
      });

      razorpay.open();
    } catch (error) {
      toast.error(getPaymentError(error, 'Unable to start checkout.'));
    }
  };

  const submitCancellation = async () => {
    try {
      await cancelSubscription.mutateAsync(cancelReason.trim() || undefined);
      toast.success('Subscription cancelled successfully.');
      setCancelReason('');
      setCancelOpen(false);
      setActiveTab('plans');
    } catch (error) {
      toast.error(getPaymentError(error, 'Unable to cancel subscription.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Multi-tenant billing
          </Badge>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{t('subscription.title')}</h1>
            <p className="text-sm text-muted-foreground">
              Manage plans, coupon checkout, payment verification, and subscription history from one place.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/wallet')}>
            <Receipt className="mr-2 h-4 w-4" />
            Wallet & invoices
          </Button>
          <Button onClick={() => setActiveTab(current ? 'overview' : 'plans')}>
            <CreditCard className="mr-2 h-4 w-4" />
            {current?.status === 'active' ? 'Manage current plan' : 'Choose a plan'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.85fr]">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-96" />)}
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {!current ? (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle>No active subscription</CardTitle>
                  <CardDescription>
                    You can browse plans, inspect plan details, apply coupons, and subscribe without leaving this page.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Subscriptions stay isolated to your authenticated tenant. Billing history and future plan changes only affect your own workspace.
                  </p>
                  <Button onClick={() => setActiveTab('plans')}>
                    Browse plans
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <Card>
                  <CardHeader className="space-y-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle className="text-2xl">{current.plan?.name || 'Active plan'}</CardTitle>
                        <CardDescription className="mt-2">
                          Current subscription details, billing totals, and plan-change actions.
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={getStatusVariant(current.status)} className="capitalize">{current.status}</Badge>
                        <Badge variant="outline">{current.plan ? humanizeKey(current.plan.type) : 'Plan'}</Badge>
                      </div>
                    </div>
                    <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                      <div><p className="text-muted-foreground">Started</p><p className="mt-1 font-medium">{formatDate(current.starts_at, { dateStyle: 'medium' })}</p></div>
                      <div><p className="text-muted-foreground">Ends</p><p className="mt-1 font-medium">{current.expires_at ? formatDate(current.expires_at, { dateStyle: 'medium' }) : 'Lifetime'}</p></div>
                      <div><p className="text-muted-foreground">Amount paid</p><p className="mt-1 font-medium">{formatCurrency(current.amount_paid, current.plan?.currency || 'INR')}</p></div>
                      <div><p className="text-muted-foreground">Auto renew</p><p className="mt-1 font-medium">{current.auto_renew ? 'Enabled' : 'Read-only / off'}</p></div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <MetricCard title="Discount" value={current.discount_amount ? formatCurrency(current.discount_amount, current.plan?.currency || 'INR') : '-'} />
                      <MetricCard title="Tax" value={formatCurrency(current.tax_amount, current.plan?.currency || 'INR')} />
                      <MetricCard title="Coupon" value={current.coupon_id ? 'Applied' : 'None'} />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => setActiveTab('plans')}>Change plan</Button>
                      <Button variant="outline" onClick={() => setCancelOpen(true)}>Cancel subscription</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Info className="h-4 w-4 text-primary" />
                      Usage against plan limits
                    </CardTitle>
                    <CardDescription>
                      These values are computed from the active plan and current usage counters from the subscription service.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {getUsageMetrics(current).map((item) => {
                      const percentage = item.limit === 0 ? 0 : Math.min(100, Math.round((item.used / item.limit) * 100));
                      return (
                        <div key={item.key} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{item.label}</span>
                            <span className="text-muted-foreground">{item.used.toLocaleString('en-IN')} / {formatLimit(item.limit)}</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="plans" className="space-y-6">
            {!plans?.length ? (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle>{t('subscription.noPlans')}</CardTitle>
                  <CardDescription>There are no active plans available right now.</CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {plans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      current={current}
                      busy={checkoutBusy}
                      onViewDetails={setDetailSlug}
                      onChoose={openCheckout}
                    />
                  ))}
                </div>
                <Card className="bg-muted/25">
                  <CardHeader>
                    <CardTitle className="text-lg">Billing notes</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                    <p>Plan changes are immediate and non-prorated. The replacement plan activates after free activation or successful payment verification.</p>
                    <p>Coupon validation is plan-specific, so the same coupon may work for one plan and fail for another.</p>
                    <p>Wallet balances, recharges, and invoices stay under the wallet module instead of being duplicated here.</p>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Subscription history
                </CardTitle>
                <CardDescription>
                  Review previous plan purchases, changes, and cancellations without using Postman.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={historyColumns}
                  data={historyData?.subscriptions || []}
                  isLoading={historyLoading}
                  page={historyData?.meta.page ?? historyPage}
                  totalPages={historyData?.meta.totalPages ?? 1}
                  total={historyData?.meta.total ?? 0}
                  onPageChange={setHistoryPage}
                  emptyMessage="No subscription history found yet."
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <PlanDetailsSheet
        slug={detailSlug}
        current={current}
        busy={checkoutBusy}
        onOpenChange={(open) => !open && setDetailSlug(null)}
        onChoose={(plan) => {
          setDetailSlug(null);
          openCheckout(plan);
        }}
      />

      <Sheet open={!!checkoutPlan} onOpenChange={(open) => !open && closeCheckout()}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{checkoutMode === 'change' ? 'Change plan' : 'Checkout'}</SheetTitle>
            <SheetDescription>
              Review plan pricing, apply a coupon, and complete checkout through Razorpay.
            </SheetDescription>
          </SheetHeader>
          {checkoutPlan && (
            <div className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{checkoutPlan.name}</CardTitle>
                      <CardDescription className="mt-1">{checkoutPlan.description || 'A production-ready WhatsApp marketing plan for your workspace.'}</CardDescription>
                    </div>
                    <Badge variant="outline">{checkoutMode === 'change' ? 'Plan change' : 'New subscription'}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 rounded-lg bg-muted/35 p-4">
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Base price</span><span className="font-medium">{formatCurrency(summary.basePrice, checkoutPlan.currency)}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Coupon discount</span><span className="font-medium">{couponResult ? `- ${formatCurrency(couponResult.discount_amount, checkoutPlan.currency)}` : '-'}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Estimated tax</span><span className="font-medium">{formatCurrency(summary.estimatedTax, checkoutPlan.currency)}</span></div>
                    <Separator />
                    <div className="flex items-center justify-between"><span className="font-medium">Estimated total</span><span className="text-lg font-semibold">{formatCurrency(summary.total, checkoutPlan.currency)}</span></div>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="coupon-code">Coupon code</Label>
                    <div className="flex gap-2">
                      <Input
                        id="coupon-code"
                        value={couponCode}
                        onChange={(event) => {
                          setCouponCode(event.target.value.toUpperCase());
                          setCouponResult(null);
                          setCouponError(null);
                        }}
                        placeholder="SAVE20"
                      />
                      <Button type="button" variant="outline" onClick={applyCoupon} disabled={!couponCode.trim() || validateCoupon.isPending}>
                        {validateCoupon.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Apply
                      </Button>
                    </div>
                    {(couponResult || couponError) && (
                      <div className={cn('rounded-md border px-3 py-2 text-sm', couponResult ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-destructive/20 bg-destructive/5 text-destructive')}>
                        {couponResult ? `${couponResult.code} applied.` : couponError}
                      </div>
                    )}
                    {couponResult && <Button type="button" variant="ghost" className="px-0 text-sm" onClick={() => { setCouponCode(''); setCouponResult(null); setCouponError(null); }}>Remove coupon</Button>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Included with this plan</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {selectedPlanFeatures.slice(0, 10).map((feature) => (
                    <div key={feature} className="flex items-start gap-2">
                      <span className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {checkoutMode === 'change' && current && (
                <Card className="border-amber-200 bg-amber-50/60">
                  <CardHeader><CardTitle className="text-lg">Plan change behavior</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Your current plan will be cancelled immediately with a machine-readable reason of <span className="font-medium text-foreground">plan_changed</span>.</p>
                    <p>The selected replacement plan becomes active after free activation or successful Razorpay payment verification.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={closeCheckout}>Close</Button>
            <Button onClick={startCheckout} disabled={!checkoutPlan || checkoutBusy}>
              {checkoutBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {checkoutMode === 'change' ? 'Confirm plan change' : 'Continue to payment'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancel subscription</DialogTitle>
            <DialogDescription>
              Cancelling disables auto-renew and marks the active subscription as cancelled immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea id="cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Tell us why you are cancelling this plan." rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep plan</Button>
            <Button variant="destructive" onClick={submitCancellation} disabled={cancelSubscription.isPending}>
              {cancelSubscription.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="bg-muted/20 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-lg font-medium">{value}</CardContent>
    </Card>
  );
}
