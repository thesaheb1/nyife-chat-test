import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { DateRangeFilter } from '@/shared/components/DateRangeFilter';
import { useAuthenticatedImageSrc } from '@/shared/hooks/useAuthenticatedImageSrc';
import { getPresetDateRange } from '@/shared/utils/dateRange';
import { formatCurrency } from '@/shared/utils/formatters';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { useCan } from '@/core/hooks/usePermissions';
import { EditUserDialog } from './EditUserDialog';
import { WalletActionDialog } from './WalletActionDialog';
import {
  useAdminUserAnalytics,
  useAdminUserDashboard,
  useAdminUserSupportTickets,
  useDeleteUser,
  useUpdateUserStatus,
  useUserInvoices,
  useUserSubscriptions,
  useUserTeamMembers,
  useUserTransactions,
} from './useAdminUsers';
import type {
  AdminUserInvoiceRecord,
  AdminUserSubscriptionRecord,
  AdminUserTeamMember,
  AdminUserTransaction,
} from '../types';
import type { SupportTicket } from '@/core/types';

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  inactive: 'secondary',
  suspended: 'destructive',
  pending_verification: 'outline',
};

const PAGE_SIZE = 10;

type DashboardTab =
  | 'overview'
  | 'wallet'
  | 'plans'
  | 'organizations'
  | 'team'
  | 'support'
  | 'analytics';

function getInitials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'U';
}

function getDefaultAnalyticsRange() {
  return getPresetDateRange('last30Days');
}

function parseDateTimeValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalizedValue = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? value.replace(' ', 'T') + 'Z'
    : value;

  const parsed = new Date(normalizedValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value?: string | null) {
  const parsed = parseDateTimeValue(value);
  return parsed
    ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(parsed)
    : 'N/A';
}

function formatDateTime(value?: string | null) {
  const parsed = parseDateTimeValue(value);
  return parsed
    ? new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed)
    : 'N/A';
}

function getInitialPages() {
  return {
    transactions: 1,
    invoices: 1,
    subscriptions: 1,
    team: 1,
    support: 1,
  };
}

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canUpdate = useCan('admin', 'users', 'update');
  const canDelete = useCan('admin', 'users', 'delete');
  const [walletAction, setWalletAction] = useState<'credit' | 'debit' | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState(getDefaultAnalyticsRange);
  const [pages, setPages] = useState(getInitialPages);

  const requestedTab = (searchParams.get('tab') as DashboardTab) || 'overview';
  const requestedOrganizationId = searchParams.get('organization_id') || undefined;
  const editOpen = searchParams.get('edit') === '1';

  const dashboardQuery = useAdminUserDashboard(id, requestedOrganizationId);
  const updateStatus = useUpdateUserStatus();
  const deleteUser = useDeleteUser();

  const dashboard = dashboardQuery.data;
  const user = dashboard?.user;
  const selectedOrganization = dashboard?.selected_organization || null;
  const organizationId = selectedOrganization?.id;
  const canSeeSupport = dashboard?.sections.support === true;
  const canSeeAnalytics = dashboard?.sections.analytics === true;
  const resolvedTab: DashboardTab = (
    requestedTab === 'wallet'
    || requestedTab === 'plans'
    || requestedTab === 'organizations'
    || requestedTab === 'team'
    || (requestedTab === 'support' && canSeeSupport)
    || (requestedTab === 'analytics' && canSeeAnalytics)
  )
    ? requestedTab
    : 'overview';

  const transactionsQuery = useUserTransactions(id, {
    page: pages.transactions,
    limit: PAGE_SIZE,
    organization_id: organizationId,
  });
  const subscriptionsQuery = useUserSubscriptions(id, {
    page: pages.subscriptions,
    limit: PAGE_SIZE,
    organization_id: organizationId,
  });
  const invoicesQuery = useUserInvoices(id, {
    page: pages.invoices,
    limit: PAGE_SIZE,
    organization_id: organizationId,
  });
  const teamMembersQuery = useUserTeamMembers(id, {
    page: pages.team,
    limit: PAGE_SIZE,
    organization_id: organizationId,
  });
  const supportQuery = useAdminUserSupportTickets({
    userId: id,
    page: pages.support,
    limit: PAGE_SIZE,
    organizationId,
    enabled: canSeeSupport,
  });
  const analyticsQuery = useAdminUserAnalytics({
    userId: selectedOrganization?.analytics_scope_id,
    date_from: analyticsRange.from,
    date_to: analyticsRange.to,
    enabled: canSeeAnalytics,
  });
  const avatarSrc = useAuthenticatedImageSrc(user?.avatar_url, user?.updated_at);

  useEffect(() => {
    setPages(getInitialPages());
  }, [id, organizationId]);

  const metricCards = useMemo(
    () => [
      {
        key: 'messages_sent',
        label: 'Messages Sent',
        value: analyticsQuery.data?.summary.messages_sent ?? 0,
      },
      {
        key: 'messages_delivered',
        label: 'Delivered',
        value: analyticsQuery.data?.summary.messages_delivered ?? 0,
      },
      {
        key: 'messages_read',
        label: 'Read',
        value: analyticsQuery.data?.summary.messages_read ?? 0,
      },
      {
        key: 'wallet_credits',
        label: 'Wallet Credits',
        value: analyticsQuery.data?.summary.wallet_credits ?? 0,
      },
      {
        key: 'wallet_debits',
        label: 'Wallet Debits',
        value: analyticsQuery.data?.summary.wallet_debits ?? 0,
      },
    ],
    [analyticsQuery.data?.summary]
  );

  const transactionColumns = useMemo<ColumnDef<AdminUserTransaction>[]>(
    () => [
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.description}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.reference_type || 'Manual'} {row.original.reference_id ? `• ${row.original.reference_id}` : ''}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <Badge variant={row.original.type === 'credit' ? 'default' : 'secondary'}>
            {row.original.type}
          </Badge>
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <span className={row.original.type === 'credit' ? 'font-semibold text-green-600' : 'font-semibold text-red-600'}>
            {row.original.type === 'credit' ? '+' : '-'}
            {formatCurrency(row.original.amount)}
          </span>
        ),
      },
      {
        accessorKey: 'balance_after',
        header: 'Balance After',
        cell: ({ row }) => formatCurrency(row.original.balance_after),
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => formatDateTime(row.original.created_at),
      },
    ],
    []
  );

  const invoiceColumns = useMemo<ColumnDef<AdminUserInvoiceRecord>[]>(
    () => [
      {
        accessorKey: 'invoice_number',
        header: 'Invoice',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.invoice_number}</div>
            <div className="text-xs text-muted-foreground">{row.original.payment_method || 'Payment method unavailable'}</div>
          </div>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
      },
      {
        accessorKey: 'total_amount',
        header: 'Total',
        cell: ({ row }) => formatCurrency(row.original.total_amount),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'paid' ? 'default' : 'secondary'}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => formatDate(row.original.created_at),
      },
    ],
    []
  );

  const subscriptionColumns = useMemo<ColumnDef<AdminUserSubscriptionRecord>[]>(
    () => [
      {
        accessorKey: 'plan_name',
        header: 'Plan',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.plan_name || row.original.plan_id}</div>
            <div className="text-xs text-muted-foreground">{row.original.plan_type || 'Custom plan'}</div>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'plan_price',
        header: 'Price',
        cell: ({ row }) => (
          <span>{row.original.plan_price ? formatCurrency(row.original.plan_price) : 'Custom'}</span>
        ),
      },
      {
        id: 'period',
        header: 'Period',
        cell: ({ row }) => (
          <span>
            {formatDate(row.original.starts_at)} to {formatDate(row.original.expires_at)}
          </span>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => formatDate(row.original.created_at),
      },
    ],
    []
  );

  const teamColumns = useMemo<ColumnDef<AdminUserTeamMember>[]>(
    () => [
      {
        id: 'name',
        header: 'Team Member',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.first_name} {row.original.last_name}</div>
            <div className="text-xs text-muted-foreground">{row.original.email}</div>
          </div>
        ),
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ row }) => row.original.phone || 'Not set',
      },
      {
        accessorKey: 'role_title',
        header: 'Role',
        cell: ({ row }) => row.original.role_title || 'Team member',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'joined_at',
        header: 'Joined',
        cell: ({ row }) => formatDate(row.original.joined_at || row.original.invited_at),
      },
    ],
    []
  );

  const supportColumns = useMemo<ColumnDef<SupportTicket>[]>(
    () => [
      {
        accessorKey: 'subject',
        header: 'Subject',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.subject}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.ticket_number} • {row.original.category}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'resolved' ? 'default' : 'secondary'}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => formatDate(row.original.created_at),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button variant="outline" size="sm" onClick={() => navigate(`/admin/support/${row.original.id}`)}>
            Open Ticket
          </Button>
        ),
      },
    ],
    [navigate]
  );

  const setDashboardParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    setSearchParams(next);
  };

  const handleStatusChange = async (status: string) => {
    if (!id) {
      return;
    }

    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success('User status updated.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update user status.'));
    }
  };

  const handleDelete = async () => {
    if (!id) {
      return;
    }

    try {
      await deleteUser.mutateAsync(id);
      toast.success('User deleted.');
      navigate('/admin/users');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete the user.'));
    }
  };

  if (dashboardQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboard || !user) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </Button>
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {getApiErrorMessage(dashboardQuery.error, 'Unable to load this user dashboard.')}
          </CardContent>
        </Card>
      </div>
    );
  }

  const transactions = transactionsQuery.data?.data?.transactions ?? [];
  const subscriptions = subscriptionsQuery.data?.data?.subscriptions ?? [];
  const invoices = invoicesQuery.data?.data?.invoices ?? [];
  const teamMembers = teamMembersQuery.data?.data?.team_members ?? [];
  const supportTickets = supportQuery.data?.data?.tickets ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] xl:items-start">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <Avatar className="mt-1 h-16 w-16 ring-1 ring-border">
            <AvatarImage src={avatarSrc} alt={user.email} className="object-cover" />
            <AvatarFallback>{getInitials(user.first_name, user.last_name)}</AvatarFallback>
          </Avatar>

          <div className="space-y-2">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {user.first_name} {user.last_name}
              </h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              {user.phone ? <p className="text-sm text-muted-foreground">{user.phone}</p> : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant={STATUS_COLORS[user.status] || 'outline'}>{user.status}</Badge>
              <Badge variant="outline">{user.role}</Badge>
              <Badge variant="outline">
                Joined {formatDate(user.created_at)}
              </Badge>
              {user.last_login_at ? (
                <Badge variant="outline">
                  Last login {formatDateTime(user.last_login_at)}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-4 xl:items-stretch">
          <div className="flex flex-wrap gap-2 xl:justify-end">
            {canUpdate ? (
              <Button variant="outline" onClick={() => setDashboardParams({ edit: '1' })}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit User
              </Button>
            ) : null}

            {canDelete ? (
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete User
              </Button>
            ) : null}
          </div>

        </div>
      </div>
      <div className="flex justify-between flex-wrap w-full">
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Organization Scope
          </div>
          <Select
            value={selectedOrganization?.id || ''}
            onValueChange={(value) => setDashboardParams({ organization_id: value })}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Select organization" />
            </SelectTrigger>
            <SelectContent>
              {dashboard.organizations.map((organization) => (
                <SelectItem key={organization.id} value={organization.id}>
                  {organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Account Status
          </div>
          {canUpdate ? (
            <Select value={user.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="flex h-10 items-center rounded-md border px-3">
              <Badge variant={STATUS_COLORS[user.status] || 'outline'}>
                {user.status}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Wallet Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(selectedOrganization?.wallet_balance || 0)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Scoped to {selectedOrganization?.name || 'the selected organization'}
            </p>
            {canUpdate ? (
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setWalletAction('credit')}>
                  Credit
                </Button>
                <Button size="sm" variant="outline" onClick={() => setWalletAction('debit')}>
                  Debit
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedOrganization?.current_plan || 'No active plan'}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedOrganization?.subscription_status || 'No subscription status'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.organizations.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Team members in selected org: {selectedOrganization?.team_members_count || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Support Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedOrganization?.support_tickets_count || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Tickets linked to {selectedOrganization?.name || 'this organization'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={resolvedTab}
        onValueChange={(value) => setDashboardParams({ tab: value })}
        className="space-y-4"
      >
        <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="team">Team Members</TabsTrigger>
          {canSeeSupport ? <TabsTrigger value="support">Support</TabsTrigger> : null}
          {canSeeAnalytics ? <TabsTrigger value="analytics">Analytics</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Core identity and account lifecycle details.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">First name</div>
                <div className="mt-1 text-sm font-medium">{user.first_name}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Last name</div>
                <div className="mt-1 text-sm font-medium">{user.last_name}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Email</div>
                <div className="mt-1 text-sm font-medium">{user.email}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Phone</div>
                <div className="mt-1 text-sm font-medium">{user.phone || 'Not set'}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Must change password</div>
                <div className="mt-1 text-sm font-medium">{user.must_change_password ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Selected organization</div>
                <div className="mt-1 text-sm font-medium">{selectedOrganization?.name || 'N/A'}</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Activity</CardTitle>
              <CardDescription>
                Balance, transactions, and invoices for {selectedOrganization?.name || 'the selected organization'}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Current balance</div>
                    <div className="mt-2 text-2xl font-bold">{formatCurrency(selectedOrganization?.wallet_balance || 0)}</div>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Transactions</div>
                    <div className="mt-2 text-2xl font-bold">{transactionsQuery.data?.meta?.total ?? 0}</div>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Invoices</div>
                    <div className="mt-2 text-2xl font-bold">{invoicesQuery.data?.meta?.total ?? 0}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Transactions</CardTitle>
                    <CardDescription>
                      Server-side pagination keeps transaction history responsive as the account grows.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DataTable
                      columns={transactionColumns}
                      data={transactions}
                      isLoading={transactionsQuery.isLoading}
                      page={transactionsQuery.data?.meta?.page ?? pages.transactions}
                      totalPages={transactionsQuery.data?.meta?.totalPages ?? 1}
                      total={transactionsQuery.data?.meta?.total ?? transactions.length}
                      onPageChange={(page) => setPages((current) => ({ ...current, transactions: page }))}
                      emptyMessage="No transactions found for this organization."
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Invoices</CardTitle>
                    <CardDescription>
                      Invoice history stays scoped to the currently selected organization.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DataTable
                      columns={invoiceColumns}
                      data={invoices}
                      isLoading={invoicesQuery.isLoading}
                      page={invoicesQuery.data?.meta?.page ?? pages.invoices}
                      totalPages={invoicesQuery.data?.meta?.totalPages ?? 1}
                      total={invoicesQuery.data?.meta?.total ?? invoices.length}
                      onPageChange={(page) => setPages((current) => ({ ...current, invoices: page }))}
                      emptyMessage="No invoices found for this organization."
                    />
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Plan Overview</CardTitle>
              <CardDescription>
                Active subscription and historical plan records for {selectedOrganization?.name || 'the selected organization'}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Current plan</div>
                    <div className="mt-2 text-2xl font-bold">{selectedOrganization?.current_plan || 'No active plan'}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Status: {selectedOrganization?.subscription_status || 'None'}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Historical records</div>
                    <div className="mt-2 text-2xl font-bold">{subscriptionsQuery.data?.meta?.total ?? 0}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Subscription History</CardTitle>
                  <CardDescription>
                    Historical subscription records are paged server-side for scalability.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={subscriptionColumns}
                    data={subscriptions}
                    isLoading={subscriptionsQuery.isLoading}
                    page={subscriptionsQuery.data?.meta?.page ?? pages.subscriptions}
                    totalPages={subscriptionsQuery.data?.meta?.totalPages ?? 1}
                    total={subscriptionsQuery.data?.meta?.total ?? subscriptions.length}
                    onPageChange={(page) => setPages((current) => ({ ...current, subscriptions: page }))}
                    emptyMessage="No subscription history found for this organization."
                  />
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organizations" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {dashboard.organizations.map((organization) => (
              <Card key={organization.id} className={organization.id === selectedOrganization?.id ? 'border-primary' : undefined}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{organization.name}</span>
                    {organization.id === selectedOrganization?.id && <Badge>
                      Selected
                    </Badge>}
                  </CardTitle>
                  <CardDescription>{organization.slug}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Wallet</div>
                      <div className="mt-1 text-sm font-medium">{formatCurrency(organization.wallet_balance)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Plan</div>
                      <div className="mt-1 text-sm font-medium">{organization.current_plan || 'No active plan'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Team members</div>
                      <div className="mt-1 text-sm font-medium">{organization.team_members_count}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Support tickets</div>
                      <div className="mt-1 text-sm font-medium">{organization.support_tickets_count || 0}</div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => toast.info('Organization details will be connected here in the next iteration.')}
                  >
                    View Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Members assigned to {selectedOrganization?.name || 'the selected organization'}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={teamColumns}
                data={teamMembers}
                isLoading={teamMembersQuery.isLoading}
                page={teamMembersQuery.data?.meta?.page ?? pages.team}
                totalPages={teamMembersQuery.data?.meta?.totalPages ?? 1}
                total={teamMembersQuery.data?.meta?.total ?? teamMembers.length}
                onPageChange={(page) => setPages((current) => ({ ...current, team: page }))}
                emptyMessage="No team members found for this organization."
              />
            </CardContent>
          </Card>
        </TabsContent>

        {canSeeSupport ? (
          <TabsContent value="support" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Support Tickets</CardTitle>
                <CardDescription>
                  Support history tied to {selectedOrganization?.name || 'the selected organization'}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={supportColumns}
                  data={supportTickets}
                  isLoading={supportQuery.isLoading}
                  page={supportQuery.data?.meta?.page ?? pages.support}
                  totalPages={supportQuery.data?.meta?.totalPages ?? 1}
                  total={supportQuery.data?.meta?.total ?? supportTickets.length}
                  onPageChange={(page) => setPages((current) => ({ ...current, support: page }))}
                  emptyMessage="No support tickets found for this organization."
                />
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {canSeeAnalytics ? (
          <TabsContent value="analytics" className="space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <DateRangeFilter value={analyticsRange} onChange={setAnalyticsRange} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {metricCards.map((metric) => (
                <Card key={metric.key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metric.key.startsWith('wallet_') ? formatCurrency(metric.value) : metric.value}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Metric Timeline</CardTitle>
                <CardDescription>
                  Date-scoped metric totals for {selectedOrganization?.name || 'the selected organization'}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analyticsQuery.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : Object.keys(analyticsQuery.data?.data || {}).length ? (
                  Object.entries(analyticsQuery.data?.data || {}).map(([metric, series]) => (
                    <div key={metric} className="rounded-lg border p-4">
                      <div className="mb-3 text-sm font-medium">
                        {metric.replaceAll('_', ' ')}
                      </div>
                      {series.length ? (
                        <div className="space-y-2">
                          {series.map((point) => (
                            <div key={`${metric}-${point.date}`} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">{point.date}</span>
                              <span className="font-medium">
                                {metric.startsWith('wallet_') ? formatCurrency(point.value) : point.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No data for this metric in the selected range.</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No analytics data found for this organization.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>

      {walletAction && id ? (
        <WalletActionDialog
          userId={id}
          action={walletAction}
          open={Boolean(walletAction)}
          onClose={() => setWalletAction(null)}
          organizationId={organizationId}
          organizationName={selectedOrganization?.name}
        />
      ) : null}

      <EditUserDialog
        open={editOpen}
        onOpenChange={(open) => setDashboardParams({ edit: open ? '1' : null })}
        user={user}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Deletion is blocked if any owned organization still has non-zero wallet balance or an active or pending subscription.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
