import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Eye,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCcw,
  ShieldBan,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/shared/components/DataTable';
import { DateRangeFilter } from '@/modules/dashboard/DateRangeFilter';
import { useDebounce } from '@/core/hooks/useDebounce';
import { formatCurrency } from '@/shared/utils/formatters';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCan } from '@/core/hooks/usePermissions';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { useAdminPlans } from '@/modules/admin/plans/useAdminPlans';
import type { AdminUserInvitation, AdminUserListItem } from '../types';
import {
  useAdminUserInvitations,
  useAdminUsers,
  useDeleteUser,
  useResendAdminUserInvitation,
  useRevokeAdminUserInvitation,
  useUpdateUserStatus,
} from './useAdminUsers';

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  inactive: 'secondary',
  suspended: 'destructive',
  pending_verification: 'outline',
};

type UserTab = 'users' | 'invitations';

export function UserListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = (searchParams.get('tab') as UserTab) || 'users';
  const activeTab: UserTab = rawTab === 'invitations' ? 'invitations' : 'users';
  const [page, setPage] = useState(1);
  const [invitationPage, setInvitationPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [revokeInvitationId, setRevokeInvitationId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const canCreate = useCan('admin', 'users', 'create');
  const canUpdate = useCan('admin', 'users', 'update');
  const canDelete = useCan('admin', 'users', 'delete');

  const usersQuery = useAdminUsers({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    plan: planFilter !== 'all' ? planFilter : undefined,
    date_from: dateRange.from,
    date_to: dateRange.to,
  });
  const invitationsQuery = useAdminUserInvitations({
    page: invitationPage,
    limit: 20,
    enabled: activeTab === 'invitations',
  });
  const plansQuery = useAdminPlans();
  const updateStatus = useUpdateUserStatus();
  const deleteUser = useDeleteUser();
  const resendInvitation = useResendAdminUserInvitation();
  const revokeInvitation = useRevokeAdminUserInvitation();

  const users = usersQuery.data?.data?.users ?? [];
  const userMeta = usersQuery.data?.meta;
  const invitations = invitationsQuery.data?.data?.invitations ?? [];
  const invitationMeta = invitationsQuery.data?.meta;
  const plans = plansQuery.data?.plans ?? [];

  const navigateToDashboard = (userId: string, tab?: string, extraParams?: Record<string, string>) => {
    const params = new URLSearchParams();
    if (tab) {
      params.set('tab', tab);
    }
    Object.entries(extraParams || {}).forEach(([key, value]) => params.set(key, value));
    const query = params.toString();
    navigate(`/admin/users/${userId}${query ? `?${query}` : ''}`);
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success('User status updated.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update user status.'));
    }
  };

  const handleDelete = async () => {
    if (!deleteId) {
      return;
    }

    try {
      await deleteUser.mutateAsync(deleteId);
      toast.success('User deleted.');
      setDeleteId(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete the user.'));
    }
  };

  const handleRevokeInvitation = async () => {
    if (!revokeInvitationId) {
      return;
    }

    try {
      await revokeInvitation.mutateAsync(revokeInvitationId);
      toast.success('Invitation revoked.');
      setRevokeInvitationId(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to revoke the invitation.'));
    }
  };

  const userColumns = useMemo<ColumnDef<AdminUserListItem>[]>(
    () => [
      {
        accessorKey: 'first_name',
        header: 'Name',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.first_name} {row.original.last_name}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.organizations_count} organization{row.original.organizations_count === 1 ? '' : 's'}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ row }) => row.original.phone || 'Not set',
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => <Badge variant="outline">{row.original.role}</Badge>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={STATUS_COLORS[row.original.status] || 'outline'}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'current_plan',
        header: 'Plan',
        cell: ({ row }) => row.original.current_plan || 'No active plan',
      },
      {
        accessorKey: 'wallet_balance',
        header: 'Wallet',
        cell: ({ row }) => formatCurrency(row.original.wallet_balance || 0),
      },
      {
        accessorKey: 'created_at',
        header: 'Joined',
        cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-row-click-ignore="true"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56"
              data-row-click-ignore="true"
              onClick={(event) => event.stopPropagation()}
            >
              <DropdownMenuItem onClick={() => navigateToDashboard(row.original.id)}>
                <Eye className="mr-2 h-4 w-4" />
                View Dashboard
              </DropdownMenuItem>
              {canUpdate ? (
                <DropdownMenuItem onClick={() => navigateToDashboard(row.original.id, 'overview', { edit: '1' })}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit User
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => navigateToDashboard(row.original.id, 'wallet')}>
                <Wallet className="mr-2 h-4 w-4" />
                View Wallet
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigateToDashboard(row.original.id, 'plans')}>
                <ShieldBan className="mr-2 h-4 w-4" />
                View Plan
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigateToDashboard(row.original.id, 'organizations')}>
                <Users className="mr-2 h-4 w-4" />
                View Organizations
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigateToDashboard(row.original.id, 'team')}>
                <Users className="mr-2 h-4 w-4" />
                View Team Members
              </DropdownMenuItem>
              {canUpdate ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger
                      data-row-click-ignore="true"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Update Status
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent
                      data-row-click-ignore="true"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {['active', 'inactive', 'suspended'].map((status) => (
                        <DropdownMenuItem
                          key={status}
                          disabled={row.original.status === status}
                          onClick={() => handleStatusChange(row.original.id, status)}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              ) : null}
              {canDelete ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteId(row.original.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete User
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [canDelete, canUpdate]
  );

  const invitationColumns = useMemo<ColumnDef<AdminUserInvitation>[]>(
    () => [
      {
        accessorKey: 'email',
        header: 'Invitee',
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
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant="secondary" className="capitalize">
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'expires_at',
        header: 'Expires',
        cell: ({ row }) => new Date(row.original.expires_at).toLocaleString(),
      },
      {
        accessorKey: 'created_at',
        header: 'Sent',
        cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            {row.original.status === 'pending' ? (
              <Button
                size="icon"
                variant="ghost"
                disabled={resendInvitation.isPending}
                onClick={async (event) => {
                  event.stopPropagation();
                  try {
                    await resendInvitation.mutateAsync(row.original.id);
                    toast.success('Invitation resent.');
                  } catch (error) {
                    toast.error(getApiErrorMessage(error, 'Failed to resend the invitation.'));
                  }
                }}
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            ) : null}
            {canDelete && row.original.status === 'pending' ? (
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive"
                onClick={(event) => {
                  event.stopPropagation();
                  setRevokeInvitationId(row.original.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [canDelete, resendInvitation.isPending]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage platform users, their invitations, access status, and organization-linked history.
          </p>
        </div>

        {canCreate ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/admin/users/create?mode=invite')}>
              <Mail className="mr-2 h-4 w-4" />
              Invite User
            </Button>
            <Button onClick={() => navigate('/admin/users/create?mode=direct')}>
              <Plus className="mr-2 h-4 w-4" />
              Create User
            </Button>
          </div>
        ) : null}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setSearchParams({ tab: value })}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <Input
                placeholder="Search by name, email, phone, organization, or team member"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="xl:max-w-md"
              />

              <div className="flex flex-col gap-3 sm:flex-row xl:ml-auto">
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={planFilter}
                  onValueChange={(value) => {
                    setPlanFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder="All plans" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All plans</SelectItem>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <DateRangeFilter
                value={dateRange}
                onChange={(range) => {
                  setDateRange(range);
                  setPage(1);
                }}
              />
              {(search || statusFilter !== 'all' || planFilter !== 'all' || dateRange.from || dateRange.to) ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                    setPlanFilter('all');
                    setDateRange({});
                    setPage(1);
                  }}
                >
                  Reset Filters
                </Button>
              ) : null}
            </div>
          </div>

          <DataTable
            columns={userColumns}
            data={users}
            isLoading={usersQuery.isLoading}
            page={page}
            totalPages={userMeta?.totalPages ?? 1}
            total={userMeta?.total ?? users.length}
            onPageChange={setPage}
            emptyMessage="No users found."
            onRowClick={(row) => navigateToDashboard(row.id)}
          />
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            Pending invitations can be resent or revoked. Accepted and expired records are kept for audit visibility.
          </div>
          <DataTable
            columns={invitationColumns}
            data={invitations}
            isLoading={invitationsQuery.isLoading}
            page={invitationPage}
            totalPages={invitationMeta?.totalPages ?? 1}
            total={invitationMeta?.total ?? invitations.length}
            onPageChange={setInvitationPage}
            emptyMessage="No user invitations found."
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              This keeps the record soft-deleted but revokes access immediately. Deletion is blocked automatically when any organization still has wallet balance or an active or pending subscription.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(revokeInvitationId)} onOpenChange={() => setRevokeInvitationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              The invite link will stop working immediately. The admin can still create a fresh invitation later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeInvitation}>Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
