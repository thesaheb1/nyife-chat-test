import { useCallback, useMemo, useState } from 'react';
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
import { DataTable } from '@/shared/components/DataTable';
import {
  ListingEmptyState,
  ListingPageHeader,
  ListingTableCard,
  ListingTabsShell,
  ListingToolbar,
} from '@/shared/components';
import { useListingState } from '@/shared/hooks/useListingState';
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
import { TabsContent } from '@/components/ui/tabs';
import { useCan } from '@/core/hooks/usePermissions';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { useAdminPlans } from '@/modules/admin/plans/useAdminPlans';
import type { AdminUserInvitation, AdminUserListItem } from '../types';
import {
  useAdminUserInvitations,
  useAdminUsers,
  useDeleteAdminUserInvitation,
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
  const userListing = useListingState({
    initialFilters: {
      status: '',
      plan: '',
    },
    syncToUrl: true,
    namespace: 'users',
  });
  const invitationListing = useListingState({
    initialFilters: {
      status: '',
    },
    syncToUrl: true,
    namespace: 'user_invitations',
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [invitationAction, setInvitationAction] = useState<{ id: string; mode: 'revoke' | 'delete' } | null>(null);

  const canCreate = useCan('admin', 'users', 'create');
  const canUpdate = useCan('admin', 'users', 'update');
  const canDelete = useCan('admin', 'users', 'delete');

  const usersQuery = useAdminUsers({
    page: userListing.page,
    limit: 20,
    search: userListing.debouncedSearch || undefined,
    status: userListing.filters.status || undefined,
    plan: userListing.filters.plan || undefined,
    date_from: userListing.dateRange.from,
    date_to: userListing.dateRange.to,
  });
  const invitationsQuery = useAdminUserInvitations({
    page: invitationListing.page,
    limit: 20,
    search: invitationListing.debouncedSearch || undefined,
    status: invitationListing.filters.status || undefined,
    date_from: invitationListing.dateRange.from,
    date_to: invitationListing.dateRange.to,
    enabled: activeTab === 'invitations',
  });
  const plansQuery = useAdminPlans();
  const updateStatus = useUpdateUserStatus();
  const deleteUser = useDeleteUser();
  const resendInvitation = useResendAdminUserInvitation();
  const revokeInvitation = useRevokeAdminUserInvitation();
  const deleteInvitation = useDeleteAdminUserInvitation();

  const users = usersQuery.data?.data?.users ?? [];
  const userMeta = usersQuery.data?.meta;
  const invitations = invitationsQuery.data?.data?.invitations ?? [];
  const invitationMeta = invitationsQuery.data?.meta;
  const plans = plansQuery.data?.plans ?? [];

  const isResendingInvitation = resendInvitation.isPending;
  const setActiveTab = (value: UserTab) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === 'users') {
        next.delete('tab');
      } else {
        next.set('tab', value);
      }
      return next;
    }, { replace: true });
  };

  const navigateToDashboard = useCallback((userId: string, tab?: string, extraParams?: Record<string, string>) => {
    const params = new URLSearchParams();
    if (tab) {
      params.set('tab', tab);
    }
    Object.entries(extraParams || {}).forEach(([key, value]) => params.set(key, value));
    const query = params.toString();
    navigate(`/admin/users/${userId}${query ? `?${query}` : ''}`);
  }, [navigate]);

  const handleStatusChange = useCallback(async (id: string, status: string) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success('User status updated.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update user status.'));
    }
  }, [updateStatus]);

  const handleResendInvitation = useCallback(async (id: string) => {
    try {
      await resendInvitation.mutateAsync(id);
      toast.success('Invitation resent.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to resend the invitation.'));
    }
  }, [resendInvitation]);

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

  const handleInvitationAction = async () => {
    if (!invitationAction) {
      return;
    }

    try {
      if (invitationAction.mode === 'revoke') {
        await revokeInvitation.mutateAsync(invitationAction.id);
        toast.success('Invitation revoked.');
      } else {
        await deleteInvitation.mutateAsync(invitationAction.id);
        toast.success('Invitation deleted.');
      }
      setInvitationAction(null);
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          invitationAction.mode === 'revoke'
            ? 'Failed to revoke the invitation.'
            : 'Failed to delete the invitation.'
        )
      );
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
    [canDelete, canUpdate, handleStatusChange, navigateToDashboard]
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
            {['pending', 'revoked', 'expired'].includes(row.original.status) ? (
              <Button
                size="icon"
                variant="ghost"
                disabled={isResendingInvitation}
                onClick={async (event) => {
                  event.stopPropagation();
                  await handleResendInvitation(row.original.id);
                }}
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            ) : null}
            {canDelete && row.original.status === 'pending' ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  setInvitationAction({ id: row.original.id, mode: 'revoke' });
                }}
              >
                Revoke
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive"
                onClick={(event) => {
                  event.stopPropagation();
                  setInvitationAction({ id: row.original.id, mode: 'delete' });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [canDelete, handleResendInvitation, isResendingInvitation]
  );

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Users"
        description="Manage platform users, invitations, access status, and account history."
        actions={canCreate ? (
          <>
            <Button variant="outline" onClick={() => navigate('/admin/users/create?mode=invite')}>
              <Mail className="mr-2 h-4 w-4" />
              Invite User
            </Button>
            <Button onClick={() => navigate('/admin/users/create?mode=direct')}>
              <Plus className="mr-2 h-4 w-4" />
              Create User
            </Button>
          </>
        ) : null}
      />

      <ListingTabsShell
        value={activeTab}
        onValueChange={(value) => setActiveTab(value === 'invitations' ? 'invitations' : 'users')}
        tabs={[
          { value: 'users', label: 'Users' },
          { value: 'invitations', label: 'Invitations' },
        ]}
      >

        <TabsContent value="users" className="space-y-4">

          <ListingTableCard>
            <ListingToolbar
              searchValue={userListing.search}
              onSearchChange={userListing.setSearch}
              searchPlaceholder="Search by name, email, phone, organization, or team member"
              filters={[
                {
                  id: 'status',
                  value: userListing.filters.status,
                  placeholder: 'Status',
                  onChange: (value) => userListing.setFilter('status', value),
                  allLabel: 'All statuses',
                  options: [
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'suspended', label: 'Suspended' },
                  ],
                },
                {
                  id: 'plan',
                  value: userListing.filters.plan,
                  placeholder: 'Plan',
                  onChange: (value) => userListing.setFilter('plan', value),
                  allLabel: 'All plans',
                  options: plans.map((plan) => ({
                    value: plan.id,
                    label: plan.name,
                  })),
                },
              ]}
              dateRange={userListing.dateRange}
              onDateRangeChange={userListing.setDateRange}
              dateRangePlaceholder="Joined date range"
              hasActiveFilters={userListing.hasActiveFilters}
              onReset={userListing.resetAll}
            />
            <DataTable
              columns={userColumns}
              data={users}
              isLoading={usersQuery.isLoading}
              page={userMeta?.page ?? userListing.page}
              totalPages={userMeta?.totalPages ?? 1}
              total={userMeta?.total ?? users.length}
              onPageChange={userListing.setPage}
              emptyMessage={(
                <ListingEmptyState
                  title="No users found"
                  description="Adjust the current filters or create a new user."
                />
              )}
              onRowClick={(row) => navigateToDashboard(row.id)}
            />
          </ListingTableCard>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">

          <ListingTableCard>
            <ListingToolbar
              searchValue={invitationListing.search}
              onSearchChange={invitationListing.setSearch}
              searchPlaceholder="Search invited users..."
              filters={[
                {
                  id: 'status',
                  value: invitationListing.filters.status,
                  placeholder: 'Status',
                  onChange: (value) => invitationListing.setFilter('status', value),
                  allLabel: 'All statuses',
                  options: [
                    { value: 'pending', label: 'Pending' },
                    { value: 'accepted', label: 'Accepted' },
                    { value: 'revoked', label: 'Revoked' },
                    { value: 'expired', label: 'Expired' },
                  ],
                },
              ]}
              dateRange={invitationListing.dateRange}
              onDateRangeChange={invitationListing.setDateRange}
              dateRangePlaceholder="Invitation date range"
              hasActiveFilters={invitationListing.hasActiveFilters}
              onReset={invitationListing.resetAll}
            />
            <DataTable
              columns={invitationColumns}
              data={invitations}
              isLoading={invitationsQuery.isLoading}
              page={invitationMeta?.page ?? invitationListing.page}
              totalPages={invitationMeta?.totalPages ?? 1}
              total={invitationMeta?.total ?? invitations.length}
              onPageChange={invitationListing.setPage}
              emptyMessage={(
                <ListingEmptyState
                  title="No user invitations found"
                  description="New invitations will appear here after you invite users."
                />
              )}
            />
          </ListingTableCard>
        </TabsContent>
      </ListingTabsShell>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the account and blocks any active session immediately. Deletion is blocked automatically when any organization still has wallet balance or an active or pending subscription.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(invitationAction)} onOpenChange={() => setInvitationAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {invitationAction?.mode === 'revoke' ? 'Revoke Invitation' : 'Delete Invitation'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {invitationAction?.mode === 'revoke'
                ? 'The invite link will stop working immediately. You can resend it later to reopen the same invitation.'
                : 'This permanently deletes the invitation from the database.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleInvitationAction}>
              {invitationAction?.mode === 'revoke' ? 'Revoke' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
