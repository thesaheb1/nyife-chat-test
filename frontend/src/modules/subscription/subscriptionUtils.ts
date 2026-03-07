import type { CouponValidationResult, Plan, Subscription } from '@/core/types';

export type CheckoutMode = 'subscribe' | 'change';

export function formatLimit(value: number) {
  return value === 0 ? 'Unlimited' : value.toLocaleString('en-IN');
}

export function humanizeKey(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function getPlanHighlights(plan: Plan) {
  const highlights = [
    `${formatLimit(plan.max_contacts)} contacts`,
    `${formatLimit(plan.max_templates)} templates`,
    `${formatLimit(plan.max_campaigns_per_month)} campaigns / month`,
    `${formatLimit(plan.max_messages_per_month)} messages / month`,
    `${formatLimit(plan.max_team_members)} team members`,
    `${formatLimit(plan.max_whatsapp_numbers)} WhatsApp numbers`,
  ];

  if (plan.has_priority_support) {
    highlights.push('Priority support');
  }

  if (plan.features && typeof plan.features === 'object') {
    Object.entries(plan.features).forEach(([key, rawValue]) => {
      if (rawValue === true) {
        highlights.push(humanizeKey(key));
      } else if (rawValue && rawValue !== false) {
        highlights.push(`${humanizeKey(key)}: ${String(rawValue)}`);
      }
    });
  }

  return highlights;
}

export function getUsageMetrics(subscription: Subscription) {
  const plan = subscription.plan;
  if (!plan) {
    return [];
  }

  return [
    { key: 'contacts', label: 'Contacts', used: subscription.usage.contacts_used, limit: plan.max_contacts },
    { key: 'templates', label: 'Templates', used: subscription.usage.templates_used, limit: plan.max_templates },
    { key: 'campaigns', label: 'Campaigns this month', used: subscription.usage.campaigns_this_month, limit: plan.max_campaigns_per_month },
    { key: 'messages', label: 'Messages this month', used: subscription.usage.messages_this_month, limit: plan.max_messages_per_month },
    { key: 'team', label: 'Team members', used: subscription.usage.team_members_used, limit: plan.max_team_members },
    { key: 'numbers', label: 'WhatsApp numbers', used: subscription.usage.whatsapp_numbers_used, limit: plan.max_whatsapp_numbers },
  ];
}

export function getPaymentError(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object'
  ) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function getStatusVariant(status: Subscription['status']) {
  switch (status) {
    case 'active':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'cancelled':
      return 'outline';
    default:
      return 'secondary';
  }
}

export function getIntervalLabel(type: Plan['type']) {
  if (type === 'yearly') return '/year';
  if (type === 'lifetime') return '/once';
  return '/month';
}

export function getCheckoutSummary(
  plan: Plan | null,
  couponResult: CouponValidationResult | null
) {
  if (!plan) {
    return {
      basePrice: 0,
      estimatedTax: 0,
      total: 0,
    };
  }

  const basePrice = plan.price;
  const discountedBase = couponResult ? couponResult.price_after_discount : basePrice;
  const estimatedTax = Math.max(0, Math.round(discountedBase * 0.18));

  return {
    basePrice,
    estimatedTax,
    total: discountedBase + estimatedTax,
  };
}
