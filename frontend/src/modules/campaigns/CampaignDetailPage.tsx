import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Play,
  Pause,
  RefreshCw,
  XCircle,
  Trash2,
  Loader2,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DataTable } from '@/shared/components/DataTable';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { formatCurrency } from '@/shared/utils/formatters';
import {
  useCampaign,
  useCampaignAnalytics,
  useCampaignMessages,
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useCancelCampaign,
  useRetryCampaign,
  useDeleteCampaign,
} from './useCampaigns';
import type { CampaignMessage } from '@/core/types';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  scheduled: 'bg-blue-100 text-blue-800',
  running: 'bg-emerald-100 text-emerald-800',
  paused: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-300 text-gray-700',
};

const MSG_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  queued: 'bg-blue-100 text-blue-700',
  sent: 'bg-sky-100 text-sky-700',
  delivered: 'bg-green-100 text-green-700',
  read: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: campaign, isLoading } = useCampaign(id);
  const { data: analytics } = useCampaignAnalytics(id);
  const [msgPage, setMsgPage] = useState(1);
  const [msgStatus, setMsgStatus] = useState('');
  const { data: messagesData, isLoading: msgsLoading } = useCampaignMessages(id, {
    page: msgPage,
    limit: 20,
    status: msgStatus || undefined,
  });

  const startCampaign = useStartCampaign();
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();
  const cancelCampaign = useCancelCampaign();
  const retryCampaign = useRetryCampaign();
  const deleteCampaign = useDeleteCampaign();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const doAction = async (action: { mutateAsync: (id: string) => Promise<unknown> }, label: string) => {
    if (!id) return;
    try {
      await action.mutateAsync(id);
      toast.success(`Campaign ${label}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Failed to ${label.toLowerCase()} campaign.`));
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteCampaign.mutateAsync(id);
      toast.success('Campaign deleted');
      navigate('/campaigns');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete campaign.'));
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    try {
      await cancelCampaign.mutateAsync(id);
      toast.success('Campaign cancelled');
      setCancelOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to cancel campaign.'));
    }
  };

  const messages = messagesData?.data?.messages ?? [];
  const msgMeta = messagesData?.meta;

  const messageColumns = useMemo<ColumnDef<CampaignMessage, unknown>[]>(
    () => [
      {
        accessorKey: 'contact_phone',
        header: 'Phone',
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const st = getValue() as string;
          return (
            <Badge className={`${MSG_STATUS_COLORS[st] || ''} text-xs`} variant="secondary">
              {st.charAt(0).toUpperCase() + st.slice(1)}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'sent_at',
        header: 'Sent At',
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? new Date(v).toLocaleString() : '—';
        },
      },
      {
        accessorKey: 'delivered_at',
        header: 'Delivered',
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? new Date(v).toLocaleString() : '—';
        },
      },
      {
        accessorKey: 'error_message',
        header: 'Error',
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? <span className="text-destructive text-xs">{v}</span> : '—';
        },
      },
      {
        accessorKey: 'retry_count',
        header: 'Retries',
        cell: ({ getValue }) => <span className="tabular-nums">{getValue() as number}</span>,
      },
    ],
    []
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!campaign) {
    return <div className="py-12 text-center text-muted-foreground">Campaign not found.</div>;
  }

  const totalProcessed =
    campaign.sent_count + campaign.delivered_count + campaign.read_count + campaign.failed_count;
  const progressPct =
    campaign.total_recipients > 0
      ? Math.round((totalProcessed / campaign.total_recipients) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`${STATUS_COLORS[campaign.status]} text-xs`} variant="secondary">
              {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
            </Badge>
            <span className="text-xs text-muted-foreground capitalize">{campaign.type}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
            <Button
              size="sm"
              onClick={() => doAction(startCampaign, 'started')}
              disabled={startCampaign.isPending}
            >
              {startCampaign.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Start
            </Button>
          )}
          {campaign.status === 'running' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => doAction(pauseCampaign, 'paused')}
              disabled={pauseCampaign.isPending}
            >
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
          )}
          {campaign.status === 'paused' && (
            <Button
              size="sm"
              onClick={() => doAction(resumeCampaign, 'resumed')}
              disabled={resumeCampaign.isPending}
            >
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
          )}
          {['completed', 'failed', 'paused'].includes(campaign.status) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => doAction(retryCampaign, 'retrying')}
              disabled={retryCampaign.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Failed
            </Button>
          )}
          {['draft', 'scheduled', 'running', 'paused'].includes(campaign.status) && (
            <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
          {campaign.status === 'draft' && (
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {campaign.total_recipients > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Progress</span>
              <span className="tabular-nums">{totalProcessed} / {campaign.total_recipients} ({progressPct}%)</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total', value: campaign.total_recipients, color: '' },
          { label: 'Sent', value: campaign.sent_count, color: 'text-sky-600' },
          { label: 'Delivered', value: campaign.delivered_count, color: 'text-green-600' },
          { label: 'Read', value: campaign.read_count, color: 'text-emerald-600' },
          { label: 'Failed', value: campaign.failed_count, color: 'text-red-600' },
          { label: 'Pending', value: campaign.pending_count, color: 'text-gray-500' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold tabular-nums ${s.color}`}>
                {s.value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analytics */}
      {analytics && (
        <>
          {/* Rates */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground">Delivery Rate</p>
                <p className="text-2xl font-bold text-green-600 tabular-nums">
                  {Number(analytics.rates.delivery_rate).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground">Read Rate</p>
                <p className="text-2xl font-bold text-emerald-600 tabular-nums">
                  {Number(analytics.rates.read_rate).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground">Failure Rate</p>
                <p className="text-2xl font-bold text-red-600 tabular-nums">
                  {Number(analytics.rates.failure_rate).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cost */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Estimated Cost</p>
                <p className="text-lg font-semibold">{formatCurrency(analytics.cost.estimated)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Actual Cost</p>
                <p className="text-lg font-semibold">{formatCurrency(analytics.cost.actual)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Timeline Chart */}
          {analytics.hourly_timeline && analytics.hourly_timeline.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sending Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={analytics.hourly_timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip
                      labelFormatter={(v) => new Date(String(v)).toLocaleString()}
                    />
                    <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Failure Reasons */}
          {analytics.failure_reasons && analytics.failure_reasons.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Failure Reasons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.failure_reasons.map((r, i) => (
                    <div key={i} className="flex items-center justify-between rounded bg-red-50 dark:bg-red-950/20 px-3 py-2">
                      <span className="text-sm">{r.reason}</span>
                      <Badge variant="secondary" className="text-xs tabular-nums">
                        {r.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Campaign Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            {campaign.description && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Description:</span> {campaign.description}
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Target:</span>{' '}
              <span className="capitalize">{campaign.target_type}</span>
            </div>
            {campaign.scheduled_at && (
              <div>
                <span className="text-muted-foreground">Scheduled:</span>{' '}
                {new Date(campaign.scheduled_at).toLocaleString()}
              </div>
            )}
            {campaign.started_at && (
              <div>
                <span className="text-muted-foreground">Started:</span>{' '}
                {new Date(campaign.started_at).toLocaleString()}
              </div>
            )}
            {campaign.completed_at && (
              <div>
                <span className="text-muted-foreground">Completed:</span>{' '}
                {new Date(campaign.completed_at).toLocaleString()}
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Created:</span>{' '}
              {new Date(campaign.created_at).toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Messages</CardTitle>
            <Select
              value={msgStatus}
              onValueChange={(v) => {
                setMsgStatus(v === 'all' ? '' : v);
                setMsgPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-32">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={messageColumns}
            data={messages}
            isLoading={msgsLoading}
            page={msgMeta?.page ?? 1}
            totalPages={msgMeta?.totalPages ?? 1}
            total={msgMeta?.total}
            onPageChange={setMsgPage}
            emptyMessage="No messages yet."
          />
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel all pending messages. Messages already sent cannot be recalled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Running</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground">
              Cancel Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the campaign "{campaign.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
