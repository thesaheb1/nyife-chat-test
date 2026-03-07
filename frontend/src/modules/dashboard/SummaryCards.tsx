import { useNavigate } from 'react-router-dom';
import { Users, FileText, Megaphone, MessageSquare, Wallet, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/shared/utils/formatters';
import type { DashboardData } from './types';

interface SummaryCardsProps {
  data: DashboardData | undefined;
  unreadChats: number;
  isLoading: boolean;
}

export function SummaryCards({ data, unreadChats, isLoading }: SummaryCardsProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Contacts',
      value: data?.contacts.total ?? 0,
      icon: Users,
      onClick: () => navigate('/contacts'),
    },
    {
      title: 'Templates',
      value: data?.templates.total ?? 0,
      icon: FileText,
      subtitle: data?.templates.by_status
        ? `${data.templates.by_status.APPROVED ?? 0} approved, ${data.templates.by_status.PENDING ?? 0} pending`
        : undefined,
      onClick: () => navigate('/templates'),
    },
    {
      title: 'Active Campaigns',
      value: data?.campaigns.by_status?.running ?? 0,
      icon: Megaphone,
      subtitle: `${data?.campaigns.total ?? 0} total`,
      onClick: () => navigate('/campaigns'),
    },
    {
      title: 'Unread Chats',
      value: unreadChats,
      icon: MessageSquare,
      onClick: () => navigate('/chat'),
    },
    {
      title: 'Wallet Balance',
      value: formatCurrency(data?.wallet.balance ?? 0),
      icon: Wallet,
      isFormatted: true,
      onClick: () => navigate('/wallet'),
    },
    {
      title: 'Subscription',
      value: data?.subscription?.plan_name ?? 'No Plan',
      icon: CreditCard,
      isFormatted: true,
      subtitle: data?.subscription
        ? `${data.subscription.status}`
        : 'Subscribe to a plan',
      onClick: () => navigate('/subscription'),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Card
          key={card.title}
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={card.onClick}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {card.isFormatted ? card.value : card.value.toLocaleString()}
            </div>
            {card.subtitle && (
              <p className="mt-1 text-xs text-muted-foreground">{card.subtitle}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface UsageProgressProps {
  data: DashboardData | undefined;
  isLoading: boolean;
}

export function UsageProgress({ data, isLoading }: UsageProgressProps) {
  if (isLoading || !data?.subscription) return null;

  const sub = data.subscription;
  // We'd ideally get plan limits from subscription/current, but we can show usage counts
  const usageItems = [
    { label: 'Contacts', used: sub.usage.contacts_used },
    { label: 'Templates', used: sub.usage.templates_used },
    { label: 'Campaigns (month)', used: sub.usage.campaigns_this_month },
    { label: 'Messages (month)', used: sub.usage.messages_this_month },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Plan Usage — {sub.plan_name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {usageItems.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{item.label}</span>
              <span>{item.used.toLocaleString()} used</span>
            </div>
            <Progress value={0} className="h-2" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
