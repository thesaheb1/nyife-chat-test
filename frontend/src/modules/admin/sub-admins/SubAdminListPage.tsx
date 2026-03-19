import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Mail, Plus, RefreshCcw, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/shared/components/DataTable';
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

export function SubAdminListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: subAdmins = [], isLoading } = useSubAdmins();
  const { data: invitations = [], isLoading: invitationsLoading } = useSubAdminInvitations();
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

  const handleCreate = async () => {
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('admin.subAdmins.title')}</h1>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <DataTable columns={subAdminColumns} data={subAdmins} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="invitations">
          <DataTable columns={invitationColumns} data={invitations} isLoading={invitationsLoading} />
        </TabsContent>
      </Tabs>

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
                placeholder="Minimum 8 characters"
              />
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
                !createForm.password.trim() ||
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
