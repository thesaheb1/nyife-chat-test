import { useTranslation } from 'react-i18next';
import {
  DollarSign,
  Users,
  CreditCard,
  LifeBuoy,
  MessageSquare,
  FileText,
  Megaphone,
  Smartphone,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminDashboard } from './useAdminDashboard';
import { RevenueChart } from './RevenueChart';
import { UserGrowthChart } from './UserGrowthChart';
import { MessageVolumeChart } from './MessageVolumeChart';
import { SubscriptionPieChart } from './SubscriptionPieChart';
import { formatCurrency } from '@/shared/utils/formatters';

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useAdminDashboard();

  const statCards = [
    {
      title: t('admin.dashboard.totalRevenue'),
      value: formatCurrency(data?.revenue.total ?? 0),
      sub: `${t('admin.dashboard.revenueToday')}: ${formatCurrency(data?.revenue.today ?? 0)}`,
      icon: DollarSign,
      color: 'text-green-500',
    },
    {
      title: t('admin.dashboard.totalUsers'),
      value: data?.users.total ?? 0,
      sub: `${t('admin.dashboard.activeUsers')}: ${data?.users.active ?? 0}`,
      icon: Users,
      color: 'text-blue-500',
    },
    {
      title: t('admin.dashboard.activeSubscriptions'),
      value: data?.subscriptions.active ?? 0,
      sub: `${t('admin.dashboard.expiringSoon')}: ${data?.subscriptions.expiring_soon ?? 0}`,
      icon: CreditCard,
      color: 'text-purple-500',
    },
    {
      title: t('admin.dashboard.openTickets'),
      value: data?.support.open_tickets ?? 0,
      sub: `${t('admin.dashboard.avgSatisfaction')}: ${data?.support.avg_satisfaction ?? 'N/A'}`,
      icon: LifeBuoy,
      color: 'text-orange-500',
    },
    {
      title: 'Messages Sent',
      value: data?.messages.sent ?? 0,
      sub: `Delivered: ${data?.messages.delivered ?? 0}`,
      icon: MessageSquare,
      color: 'text-cyan-500',
    },
    {
      title: 'Templates',
      value: data?.templates.total ?? 0,
      sub: null,
      icon: FileText,
      color: 'text-indigo-500',
    },
    {
      title: 'Campaigns',
      value: data?.campaigns.total ?? 0,
      sub: null,
      icon: Megaphone,
      color: 'text-pink-500',
    },
    {
      title: 'WhatsApp Accounts',
      value: data?.whatsapp_accounts.total ?? 0,
      sub: null,
      icon: Smartphone,
      color: 'text-emerald-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('admin.dashboard.title')}</h1>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{card.value}</div>
                  {card.sub && (
                    <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart data={data?.charts.revenue_timeline} isLoading={isLoading} />
        </div>
        <SubscriptionPieChart data={data?.subscriptions.by_plan} isLoading={isLoading} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <UserGrowthChart data={data?.charts.user_growth} isLoading={isLoading} />
        <MessageVolumeChart data={data?.charts.message_volume} isLoading={isLoading} />
      </div>

      {/* Support Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('admin.dashboard.openTickets')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{data?.support.open_tickets ?? 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('admin.dashboard.avgResolution')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{data?.support.avg_resolution_hours ?? 'N/A'}h</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('admin.dashboard.avgSatisfaction')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{data?.support.avg_satisfaction ?? 'N/A'}/5</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
