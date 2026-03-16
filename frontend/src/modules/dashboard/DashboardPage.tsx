import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';
import { SummaryCards, UsageProgress } from './SummaryCards';
import { MessagesChart } from './MessagesChart';
import { CampaignPieChart } from './CampaignPieChart';
import { QuickActions } from './QuickActions';
import { RecentActivity } from './RecentActivity';
import { DateRangeFilter } from '@/shared/components/DateRangeFilter';
import { useDashboardData } from './useDashboardData';

export function DashboardPage() {
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const [selectedWaAccountId, setSelectedWaAccountId] = useState<string>('all');
  const { data: waAccounts = [] } = useWhatsAppAccounts();
  const waAccountOptions = useMemo(
    () => waAccounts
      .filter((account) => account.status === 'active')
      .map((account) => ({
        value: account.id,
        label: account.display_phone || account.verified_name || account.waba_id,
      })),
    [waAccounts]
  );
  const dashboardWaAccountId = selectedWaAccountId === 'all' ? undefined : selectedWaAccountId;

  const { data, isLoading } = useDashboardData({
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    waAccountId: dashboardWaAccountId,
  });
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={selectedWaAccountId} onValueChange={setSelectedWaAccountId}>
            <SelectTrigger className="min-w-[220px]">
              <SelectValue placeholder="All phone numbers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All phone numbers</SelectItem>
              {waAccountOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards data={data} unreadChats={data?.chats.unread ?? 0} isLoading={isLoading} />

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
