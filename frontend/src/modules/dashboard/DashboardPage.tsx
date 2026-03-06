import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SummaryCards, UsageProgress } from './SummaryCards';
import { MessagesChart } from './MessagesChart';
import { CampaignPieChart } from './CampaignPieChart';
import { QuickActions } from './QuickActions';
import { RecentActivity } from './RecentActivity';
import { useDashboardData, useUnreadChatsCount } from './useDashboardData';
import { DateRangeFilter } from './DateRangeFilter';

export function DashboardPage() {
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});

  const { data, isLoading } = useDashboardData({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });

  const { data: unreadChats = 0 } = useUnreadChatsCount();
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary Cards */}
      <SummaryCards data={data} unreadChats={unreadChats} isLoading={isLoading} />

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MessagesChart timeline={data?.timeline} isLoading={isLoading} />
        </div>
        <CampaignPieChart byStatus={data?.campaigns.by_status} isLoading={isLoading} />
      </div>

      {/* Bottom Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivity
            transactions={data?.wallet.recent_transactions}
            todayMessages={data?.messages.today}
            isLoading={isLoading}
          />
        </div>
        <div className="space-y-4">
          <QuickActions />
          <UsageProgress data={data} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
