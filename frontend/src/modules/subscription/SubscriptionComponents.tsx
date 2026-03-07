import { BadgeCheck, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/shared/utils/formatters';
import { cn } from '@/lib/utils';
import type { Plan, Subscription } from '@/core/types';
import { useSubscriptionPlanDetails } from './useSubscriptions';
import { getIntervalLabel, getPlanHighlights, getStatusVariant, humanizeKey } from './subscriptionUtils';

interface PlanCardProps {
  plan: Plan;
  current: Subscription | null | undefined;
  busy: boolean;
  onViewDetails: (slug: string) => void;
  onChoose: (plan: Plan) => void;
}

export function PlanCard({ plan, current, busy, onViewDetails, onChoose }: PlanCardProps) {
  const isCurrent = current?.status === 'active' && current.plan_id === plan.id;
  const buttonLabel = isCurrent ? 'Current plan' : current?.status === 'active' ? 'Change plan' : 'Choose plan';

  return (
    <Card className={cn('flex h-full flex-col', isCurrent && 'border-primary ring-1 ring-primary')}>
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">{plan.name}</CardTitle>
            <CardDescription className="mt-1">{plan.description || 'Messaging, automation, templates, and billing limits for your team.'}</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={isCurrent ? 'default' : 'outline'}>{humanizeKey(plan.type)}</Badge>
            {isCurrent && <Badge variant="secondary">Current</Badge>}
          </div>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-semibold">{formatCurrency(plan.price, plan.currency)}</span>
          <span className="pb-1 text-sm text-muted-foreground">{getIntervalLabel(plan.type)}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <div className="grid gap-2 rounded-lg bg-muted/40 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Marketing message</span>
            <span className="font-medium">{formatCurrency(plan.marketing_message_price, plan.currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Utility message</span>
            <span className="font-medium">{formatCurrency(plan.utility_message_price, plan.currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Authentication message</span>
            <span className="font-medium">{formatCurrency(plan.auth_message_price, plan.currency)}</span>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          {getPlanHighlights(plan).slice(0, 7).map((highlight) => (
            <div key={highlight} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 text-primary" />
              <span>{highlight}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <Button onClick={() => onChoose(plan)} disabled={busy || isCurrent}>
            {buttonLabel}
          </Button>
          <Button variant="outline" onClick={() => onViewDetails(plan.slug)}>
            View details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface PlanDetailsSheetProps {
  slug: string | null;
  current: Subscription | null | undefined;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (plan: Plan) => void;
}

export function PlanDetailsSheet({ slug, current, busy, onOpenChange, onChoose }: PlanDetailsSheetProps) {
  const { data: plan, isLoading } = useSubscriptionPlanDetails(slug);
  const isCurrent = current?.status === 'active' && current.plan_id === plan?.id;

  return (
    <Sheet open={!!slug} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{plan?.name || 'Plan details'}</SheetTitle>
          <SheetDescription>
            Detailed plan limits, billing, and WhatsApp messaging prices.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          )}

          {!isLoading && plan && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-2xl">{plan.name}</CardTitle>
                      <CardDescription className="mt-2">{plan.description || 'Built for WhatsApp campaigns, templates, chats, and automations.'}</CardDescription>
                    </div>
                    <Badge variant={isCurrent ? getStatusVariant('active') : 'outline'}>{humanizeKey(plan.type)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-semibold">{formatCurrency(plan.price, plan.currency)}</span>
                    <span className="pb-1 text-sm text-muted-foreground">{getIntervalLabel(plan.type)}</span>
                  </div>
                  <div className="grid gap-3 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Marketing message</span>
                      <span className="font-medium">{formatCurrency(plan.marketing_message_price, plan.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Utility message</span>
                      <span className="font-medium">{formatCurrency(plan.utility_message_price, plan.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Authentication message</span>
                      <span className="font-medium">{formatCurrency(plan.auth_message_price, plan.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Priority support</span>
                      <span className="font-medium">{plan.has_priority_support ? 'Included' : 'Not included'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Limits and included features</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {getPlanHighlights(plan).map((highlight) => (
                    <div key={highlight} className="flex items-start gap-2">
                      <BadgeCheck className="mt-0.5 h-4 w-4 text-primary" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => plan && onChoose(plan)} disabled={busy || !plan || isCurrent}>
            {current?.status === 'active' && !isCurrent ? 'Change to this plan' : 'Choose this plan'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
