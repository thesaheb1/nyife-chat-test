import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { TimelineEntry } from './types';

interface MessagesChartProps {
  timeline: TimelineEntry[] | undefined;
  isLoading: boolean;
}

export function MessagesChart({ timeline, isLoading }: MessagesChartProps) {
  const chartData = useMemo(() => {
    if (!timeline?.length) return [];

    // Group by date, pivot metrics into columns
    const grouped: Record<string, { date: string; sent: number; delivered: number; read: number; failed: number }> = {};

    for (const entry of timeline) {
      if (!grouped[entry.date]) {
        grouped[entry.date] = { date: entry.date, sent: 0, delivered: 0, read: 0, failed: 0 };
      }
      if (entry.metric === 'messages_sent') grouped[entry.date].sent = entry.value;
      if (entry.metric === 'messages_delivered') grouped[entry.date].delivered = entry.value;
      if (entry.metric === 'messages_read') grouped[entry.date].read = entry.value;
      if (entry.metric === 'messages_failed') grouped[entry.date].failed = entry.value;
    }

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [timeline]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Messages — Last 30 Days</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No message data available yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tickFormatter={(v: string) => {
                  const d = new Date(v);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
              />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                labelFormatter={(v) => new Date(String(v)).toLocaleDateString()}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="sent" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} name="Sent" />
              <Line type="monotone" dataKey="delivered" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="Delivered" />
              <Line type="monotone" dataKey="read" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} name="Read" />
              <Line type="monotone" dataKey="failed" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} name="Failed" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
