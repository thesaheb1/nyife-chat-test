import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/shared/utils/formatters';
import type { RecentTransaction, MessageStats } from './types';

interface RecentActivityProps {
  transactions: RecentTransaction[] | undefined;
  todayMessages: MessageStats | undefined;
  isLoading: boolean;
}

export function RecentActivity({ transactions, todayMessages, isLoading }: RecentActivityProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Today's message stats */}
        {todayMessages && (
          <div className="rounded-md border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Today's Messages</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-lg font-semibold">{todayMessages.sent}</p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{todayMessages.delivered}</p>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{todayMessages.read}</p>
                <p className="text-xs text-muted-foreground">Read</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-destructive">{todayMessages.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </div>
        )}

        {/* Recent transactions */}
        {transactions && transactions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Recent Transactions</p>
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  {tx.type === 'credit' ? (
                    <ArrowDownLeft className="h-4 w-4 text-green-500" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-red-500" />
                  )}
                  <div>
                    <p className="text-sm">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge variant={tx.type === 'credit' ? 'default' : 'secondary'}>
                  {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No recent transactions</p>
        )}
      </CardContent>
    </Card>
  );
}
