import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Mail, Plus, RefreshCcw, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/shared/components/DataTable';
import {
  ListingEmptyState,
  ListingPageHeader,
  ListingTableCard,
  ListingTabsShell,
  ListingToolbar,
} from '@/shared/components';
import { useListingState } from '@/shared/hooks/useListingState';
import { PasswordStrengthMeter } from '@/shared/components/PasswordStrengthMeter';
import { PASSWORD_POLICY_MESSAGE, isStrongPassword } from '@/shared/utils/password';
import {
  useSubAdmins,
  useCreateSubAdmin,
  useDeleteSubAdmin,
  useDeleteSubAdminInvitation,
  useRoles,
  useInviteSubAdmin,
  useSubAdminInvitations,
  useResendSubAdminInvitation,
  useRevokeSubAdminInvitation,
  useUpdateSubAdmin,
} from './useSubAdmins';
import type { SubAdmin, SubAdminInvitation } from '../types';
import { getApiErrorMessage } from '@/core/errors/apiError';

type CreateFormState = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role_id: string;
};

type InviteFormState = {
  first_name: string;
  last_name: string;
  email: string;
  role_id: string;
};

type EditFormState = {
  id: string;
  role_id: string;
  status: 'active' | 'inactive';
};

const EMPTY_CREATE_FORM: CreateFormState = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  role_id: '',
};

const EMPTY_INVITE_FORM: InviteFormState = {
  first_name: '',
  last_name: '',
  email: '',
  role_id: '',
};

type SubAdminTab = 'accounts' | 'invitations';

export function SubAdminListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'invitations' ? 'invitations' : 'accounts';
  const accountListing = useListingState({
    initialFilters: {
      status: '',
    },
    syncToUrl: true,
    namespace: 'sub_admin_accounts',
  });
  const invitationListing = useListingState({
    initialFilters: {
      status: '',
    },
    syncToUrl: true,
    namespace: 'sub_admin_invitations',
  });
  const { data: subAdminsResult, isLoading } = useSubAdmins({
    page: accountListing.page,
    limit: 20,
    search: accountListing.debouncedSearch || undefined,
    status: (accountListing.filters.status || undefined) as 'active' | 'inactive' | undefined,
    date_from: accountListing.dateRange.from,
    date_to: accountListing.dateRange.to,
  });
  const { data: invitationsResult, isLoading: invitationsLoading } = useSubAdminInvitations({
    page: invitationListing.page,
    limit: 20,
    search: invitationListing.debouncedSearch || undefined,
    status: (invitationListing.filters.status || undefined) as 'pending' | 'accepted' | 'revoked' | 'expired' | undefined,
    date_from: invitationListing.dateRange.from,
    date_to: invitationListing.dateRange.to,
  });
  const { data: roles = [] } = useRoles();
  const createSubAdmin = useCreateSubAdmin();
  const inviteSubAdmin = useInviteSubAdmin();
  const deleteSubAdmin = useDeleteSubAdmin();
  const updateSubAdmin = useUpdateSubAdmin();
  const resendInvitation = useResendSubAdminInvitation();
  const revokeInvitation = useRevokeSubAdminInvitation();
  const deleteInvitation = useDeleteSubAdminInvitation();
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [invitationAction, setInvitationAction] = useState<{ id: string; mode: 'revoke' | 'delete' } | null>(null);
  const [createForm, setCreateForm] = useState<CreateFormState>(EMPTY_CREATE_FORM);
  const [inviteForm, setInviteForm] = useState<InviteFormState>(EMPTY_INVITE_FORM);
  const isResendingInvitation = resendInvitation.isPending;
  const subAdmins = subAdminsResult?.data ?? [];
  const subAdminMeta = subAdminsResult?.meta;
  const invitations = invitationsResult?.data ?? [];
  const invitationMeta = invitationsResult?.meta;
  const setActiveTab = (value: SubAdminTab) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === 'accounts') {
        next.delete('tab');
      } else {
        next.set('tab', value);
      }
      return next;
    }, { replace: true });
  };

  const handleCreate = async () => {
    if (!isStrongPassword(createForm.password)) {
      toast.error(PASSWORD_POLICY_MESSAGE);
      return;
    }

    try {
      await createSubAdmin.mutateAsync(createForm);
      toast.success('Sub-admin account created. Share the temporary password securely.');
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE_FORM);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to create the sub-admin account.'));
    }
  };

  const handleInvite = async () => {
    try {
      await inviteSubAdmin.mutateAsync(inviteForm);
      toast.success('Sub-admin invitation sent.');
      setShowInvite(false);
      setInviteForm(EMPTY_INVITE_FORM);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to send the sub-admin invitation.'));
    }
  };

  const handleDelete = async () => {
    if (!deleteId) {
      return;
    }

    try {
      await deleteSubAdmin.mutateAsync(deleteId);
      toast.success('Sub-admin removed.');
      setDeleteId(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to remove the sub-admin.'));
    }
  };

  const handleSaveEdit = async () => {
    if (!editForm) {
      return;
    }

    try {
      await updateSubAdmin.mutateAsync(editForm);
      toast.success('Sub-admin updated.');
      setEditForm(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update the sub-admin.'));
    }
  };

  const handleToggleStatus = useCallback(async (subAdmin: SubAdmin) => {
    const nextStatus = subAdmin.status === 'active' ? 'inactive' : 'active';

    try {
      await updateSubAdmin.mutateAsync({
        id: subAdmin.id,
        status: nextStatus,
      });
      toast.success(`Sub-admin ${nextStatus === 'active' ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update sub-admin status.'));
    }
  }, [updateSubAdmin]);

  const handleResendInvitation = useCallback(async (invitationId: string) => {
    try {
      await resendInvitation.mutateAsync(invitationId);
      toast.success('Invitation resent.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to resend the invitation.'));
    }
  }, [resendInvitation]);

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

  const subAdminColumns = useMemo<ColumnDef<SubAdmin>[]>(
    () => [
      {
        accessorKey: 'user',
        header: 'User',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">
              {row.original.user?.first_name} {row.original.user?.last_name}
            </div>
            <div className="text-xs text-muted-foreground">{row.original.user?.email}</div>
          </div>
        ),
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => <Badge variant="outline">{row.original.role?.title ?? row.original.role_id}</Badge>,
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
        accessorKey: 'last_login_at',
        header: 'Last Login',
        cell: ({ row }) =>
          row.original.last_login_at ? new Date(row.original.last_login_at).toLocaleString() : 'Never',
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                setEditForm({
                  id: row.original.id,
                  role_id: row.original.role_id,
                  status: row.original.status,
                });
              }}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                void handleToggleStatus(row.original);
              }}
            >
              {row.original.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                setDeleteId(row.original.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [handleToggleStatus]
  );

  const invitationColumns = useMemo<ColumnDef<SubAdminInvitation>[]>(
    () => [
      {
        accessorKey: 'email',
        header: 'Invitee',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">
              {row.original.first_name} {row.original.last_name}
            </div>
            <div className="text-xs text-muted-foreground">{row.original.email}</div>
          </div>
        ),
      },
      {
        accessorKey: 'role_title',
        header: 'Role',
        cell: ({ row }) => <Badge variant="outline">{row.original.role_title}</Badge>,
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
        cell: ({ row }) => new Date(row.original.expires_at).toLocaleDateString(),
      },
      {
        id: 'actions',
        header: '',
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
            {row.original.status === 'pending' ? (
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
            <Button
              size="icon"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                setInvitationAction({ id: row.original.id, mode: 'delete' });
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [handleResendInvitation, isResendingInvitation]
  );

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title={t('admin.subAdmins.title')}
        description="Manage sub-admin accounts, roles, and invitations from one standardized admin view."
        actions={(
          <>
            <Button variant="outline" onClick={() => navigate('/admin/sub-admins/roles')}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {t('admin.roles.title')}
            </Button>
            <Button variant="outline" onClick={() => setShowInvite(true)}>
              <Mail className="mr-2 h-4 w-4" />
              Invite Sub-Admin
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              {t('admin.subAdmins.createSubAdmin')}
            </Button>
          </>
        )}
      />

      <ListingTabsShell
        value={activeTab}
        onValueChange={(value) => setActiveTab(value === 'invitations' ? 'invitations' : 'accounts')}
        tabs={[
          { value: 'accounts', label: 'Accounts' },
          { value: 'invitations', label: 'Invitations' },
        ]}
      >

        <TabsContent value="accounts">
          <div className="space-y-4">

            <ListingTableCard>
              <ListingToolbar
                searchValue={accountListing.search}
                onSearchChange={accountListing.setSearch}
                searchPlaceholder="Search sub-admins..."
                filters={[
                  {
                    id: 'status',
                    value: accountListing.filters.status,
                    placeholder: 'Status',
                    onChange: (value) => accountListing.setFilter('status', value),
                    allLabel: 'All statuses',
                    options: [
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' },
                    ],
                  },
                ]}
                dateRange={accountListing.dateRange}
                onDateRangeChange={accountListing.setDateRange}
                dateRangePlaceholder="Created date range"
                hasActiveFilters={accountListing.hasActiveFilters}
                onReset={accountListing.resetAll}
              />
              <DataTable
                columns={subAdminColumns}
                data={subAdmins}
                isLoading={isLoading}
                page={subAdminMeta?.page ?? accountListing.page}
                totalPages={subAdminMeta?.totalPages ?? 1}
                total={subAdminMeta?.total ?? subAdmins.length}
                onPageChange={accountListing.setPage}
                emptyMessage={(
                  <ListingEmptyState
                    title="No sub-admin accounts found"
                    description="Create a sub-admin account or adjust the current filters."
                  />
                )}
              />
            </ListingTableCard>
          </div>
        </TabsContent>

        <TabsContent value="invitations">
          <div className="space-y-4">

            <ListingTableCard>
              <ListingToolbar
                searchValue={invitationListing.search}
                onSearchChange={invitationListing.setSearch}
                searchPlaceholder="Search invited sub-admins..."
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
                isLoading={invitationsLoading}
                page={invitationMeta?.page ?? invitationListing.page}
                totalPages={invitationMeta?.totalPages ?? 1}
                total={invitationMeta?.total ?? invitations.length}
                onPageChange={invitationListing.setPage}
                emptyMessage={(
                  <ListingEmptyState
                    title="No sub-admin invitations found"
                    description="New invitations will appear here once they are sent."
                  />
                )}
              />
            </ListingTableCard>
          </div>
        </TabsContent>
      </ListingTabsShell>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.subAdmins.createSubAdmin')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={createForm.first_name}
                onChange={(event) => setCreateForm((current) => ({ ...current, first_name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input
                value={createForm.last_name}
                onChange={(event) => setCreateForm((current) => ({ ...current, last_name: event.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Temporary Password</Label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Use uppercase, lowercase, number, and symbol"
              />
              <PasswordStrengthMeter password={createForm.password} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('admin.subAdmins.role')}</Label>
              <Select
                value={createForm.role_id}
                onValueChange={(value) => setCreateForm((current) => ({ ...current, role_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createSubAdmin.isPending ||
                !createForm.first_name.trim() ||
                !createForm.last_name.trim() ||
                !createForm.email.trim() ||
                !isStrongPassword(createForm.password) ||
                !createForm.role_id
              }
            >
              {createSubAdmin.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Sub-Admin</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={inviteForm.first_name}
                onChange={(event) => setInviteForm((current) => ({ ...current, first_name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input
                value={inviteForm.last_name}
                onChange={(event) => setInviteForm((current) => ({ ...current, last_name: event.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('admin.subAdmins.role')}</Label>
              <Select
                value={inviteForm.role_id}
                onValueChange={(value) => setInviteForm((current) => ({ ...current, role_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleInvite}
              disabled={
                inviteSubAdmin.isPending ||
                !inviteForm.first_name.trim() ||
                !inviteForm.last_name.trim() ||
                !inviteForm.email.trim() ||
                !inviteForm.role_id
              }
            >
              {inviteSubAdmin.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editForm)} onOpenChange={(open) => (!open ? setEditForm(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sub-Admin</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>{t('admin.subAdmins.role')}</Label>
              <Select
                value={editForm?.role_id ?? ''}
                onValueChange={(value) => setEditForm((current) => (
                  current
                    ? { ...current, role_id: value }
                    : current
                ))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editForm?.status ?? 'active'}
                onValueChange={(value) => setEditForm((current) => (
                  current
                    ? { ...current, status: value as 'active' | 'inactive' }
                    : current
                ))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditForm(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateSubAdmin.isPending || !editForm?.role_id}
            >
              {updateSubAdmin.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Sub-Admin</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the sub-admin record and revokes their admin access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
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
                ? 'This invitation will no longer be usable until it is resent again.'
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
