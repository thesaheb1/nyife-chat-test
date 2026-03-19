import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Loader2, Mail, RefreshCcw, Trash2, UserPlus, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/shared/components/DataTable';
import { PermissionMatrix } from '@/shared/components/PermissionMatrix';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { organizationQueryKey } from '@/core/queryKeys';
import { getApiErrorMessage } from '@/core/errors/apiError';
import type { ApiResponse, OrganizationInvitation, PaginationMeta, Permissions, Subscription, TeamMember } from '@/core/types';
import { usePermissions } from '@/core/hooks/usePermissions';
import { ORGANIZATION_ASSIGNABLE_RESOURCE_DEFINITIONS } from '@/core/permissions/catalog';
import { createEmptyPermissions, normalizePermissions } from './permissions';

type MemberFormState = {
  first_name: string;
  last_name: string;
  email: string;
  role_title: string;
  temporary_password: string;
  permissions: Permissions;
};

type InviteFormState = {
  first_name: string;
  last_name: string;
  email: string;
  role_title: string;
  permissions: Permissions;
};

const EMPTY_MEMBER_FORM = (): MemberFormState => ({
  first_name: '',
  last_name: '',
  email: '',
  role_title: '',
  temporary_password: '',
  permissions: createEmptyPermissions(),
});

const EMPTY_INVITE_FORM = (): InviteFormState => ({
  first_name: '',
  last_name: '',
  email: '',
  role_title: '',
  permissions: createEmptyPermissions(),
});

function useTeamMembers(orgId: string | undefined, page = 1, userId?: string | null, enabled = true) {
  return useQuery<{ data: TeamMember[]; meta: PaginationMeta }>({
    queryKey: organizationQueryKey(['team-members', orgId, page] as const, userId, orgId),
    enabled: Boolean(userId && orgId) && enabled,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<TeamMember[]>>(
        `${ENDPOINTS.ORGANIZATIONS.MEMBERS(orgId!)}?page=${page}&limit=20`
      );
      return { data: data.data, meta: data.meta! };
    },
  });
}

function useInvitations(orgId: string | undefined, page = 1, userId?: string | null, enabled = true) {
  return useQuery<{ data: OrganizationInvitation[]; meta: PaginationMeta }>({
    queryKey: organizationQueryKey(['team-invitations', orgId, page] as const, userId, orgId),
    enabled: Boolean(userId && orgId) && enabled,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<OrganizationInvitation[]>>(
        `${ENDPOINTS.ORGANIZATIONS.INVITATIONS(orgId!)}?page=${page}&limit=20`
      );
      return { data: data.data, meta: data.meta! };
    },
  });
}

function useCurrentSubscription(orgId: string | undefined, userId?: string | null, enabled = true) {
  return useQuery<Subscription | null>({
    queryKey: organizationQueryKey(['subscription', 'current'] as const, userId, orgId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ subscription: Subscription | null }>>(
        ENDPOINTS.SUBSCRIPTIONS.CURRENT
      );
      return data.data.subscription;
    },
    enabled: Boolean(userId && orgId) && enabled,
  });
}

export function TeamMembersPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeOrganization, canOrganization, user } = usePermissions();
  const organizationId = activeOrganization?.id;
  const userId = user?.id;
  const canRead = canOrganization('team_members', 'read');
  const canCreate = canOrganization('team_members', 'create');
  const canUpdate = canOrganization('team_members', 'update');
  const canDelete = canOrganization('team_members', 'delete');
  const activeTab = searchParams.get('tab') === 'invitations' ? 'invitations' : 'members';
  const inviteRequested = searchParams.get('invite') === '1';
  const [memberPage, setMemberPage] = useState(1);
  const [invitePage, setInvitePage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(() => inviteRequested && canCreate);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; type: 'member' } | null>(null);
  const [invitationAction, setInvitationAction] = useState<{ id: string; mode: 'revoke' | 'delete' } | null>(null);
  const [memberForm, setMemberForm] = useState<MemberFormState>(EMPTY_MEMBER_FORM);
  const [inviteForm, setInviteForm] = useState<InviteFormState>(EMPTY_INVITE_FORM);
  const [editRoleTitle, setEditRoleTitle] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editPermissions, setEditPermissions] = useState<Permissions>(createEmptyPermissions());
  const inviteOpen = inviteDialogOpen || (inviteRequested && canCreate);

  const membersQuery = useTeamMembers(organizationId, memberPage, userId, canRead);
  const invitationsQuery = useInvitations(organizationId, invitePage, userId, canRead);
  const subscriptionQuery = useCurrentSubscription(organizationId, userId, canRead);

  const members = membersQuery.data?.data || [];
  const invitations = invitationsQuery.data?.data || [];
  const memberMeta = membersQuery.data?.meta;
  const invitationMeta = invitationsQuery.data?.meta;
  const subscription = subscriptionQuery.data;
  const activeMemberCount = members.filter((member) => member.status === 'active').length;
  const pendingInvitationCount = invitations.filter((invitation) => invitation.status === 'pending').length;
  const seatsUsed = subscription?.usage?.team_members_used ?? activeMemberCount + pendingInvitationCount;
  const maxSeats = subscription?.plan?.max_team_members ?? 0;
  const availableSeats = maxSeats === 0 ? null : Math.max(0, maxSeats - seatsUsed);

  const updateTeamView = (tab: 'members' | 'invitations', invite = false) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);

      if (tab === 'members') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }

      if (invite) {
        next.set('invite', '1');
      } else {
        next.delete('invite');
      }

      return next;
    }, { replace: true });
  };

  const openInviteDialog = () => {
    setInviteDialogOpen(true);
    updateTeamView('invitations', true);
  };

  const closeInviteDialog = () => {
    setInviteDialogOpen(false);
    updateTeamView('invitations');
  };

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['team-members'] }),
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] }),
      queryClient.invalidateQueries({ queryKey: ['subscription', 'current'] }),
    ]);
  };

  const createMemberMutation = useMutation({
    mutationFn: async (payload: MemberFormState) => {
      const { data } = await apiClient.post<ApiResponse<TeamMember>>(
        ENDPOINTS.ORGANIZATIONS.CREATE_MEMBER_ACCOUNT(organizationId!),
        payload
      );
      return data.data;
    },
    onSuccess: async () => {
      await refreshQueries();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (payload: InviteFormState) => {
      const { data } = await apiClient.post<ApiResponse<OrganizationInvitation>>(
        ENDPOINTS.ORGANIZATIONS.MEMBERS(organizationId!),
        payload
      );
      return data.data;
    },
    onSuccess: async () => {
      await refreshQueries();
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async (payload: { memberId: string; role_title: string; status: 'active' | 'inactive' | 'invited'; permissions: Permissions }) => {
      const { data } = await apiClient.put<ApiResponse<TeamMember>>(
        `${ENDPOINTS.ORGANIZATIONS.MEMBERS(organizationId!)}/${payload.memberId}`,
        {
          role_title: payload.role_title,
          status: payload.status,
          permissions: payload.permissions,
        }
      );
      return data.data;
    },
    onSuccess: async () => {
      await refreshQueries();
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      await apiClient.post(ENDPOINTS.ORGANIZATIONS.RESEND_INVITATION(organizationId!, invitationId));
    },
    onSuccess: async () => {
      await refreshQueries();
    },
  });
  const isResendingInvitation = resendMutation.isPending;

  const revokeMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      await apiClient.post(ENDPOINTS.ORGANIZATIONS.REVOKE_INVITATION(organizationId!, invitationId));
    },
    onSuccess: async () => {
      await refreshQueries();
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      await apiClient.delete(ENDPOINTS.ORGANIZATIONS.DELETE_INVITATION(organizationId!, invitationId));
    },
    onSuccess: async () => {
      await refreshQueries();
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await apiClient.delete(`${ENDPOINTS.ORGANIZATIONS.MEMBERS(organizationId!)}/${memberId}`);
    },
    onSuccess: async () => {
      await refreshQueries();
    },
  });

  const handleCreateMember = async () => {
    try {
      await createMemberMutation.mutateAsync(memberForm);
      toast.success('Team account created. Share the temporary password securely.');
      setCreateOpen(false);
      setMemberForm(EMPTY_MEMBER_FORM());
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to create the team account.'));
    }
  };

  const handleInviteMember = async () => {
    try {
      await inviteMutation.mutateAsync(inviteForm);
      toast.success('Invitation sent successfully.');
      closeInviteDialog();
      setInviteForm(EMPTY_INVITE_FORM());
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to send the invitation.'));
    }
  };

  const handleUpdateMember = async () => {
    if (!editMember) {
      return;
    }

    try {
      await updateMemberMutation.mutateAsync({
        memberId: editMember.id,
        role_title: editRoleTitle,
        status: editStatus,
        permissions: editPermissions,
      });
      toast.success('Team member updated successfully.');
      setEditMember(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to update this team member.'));
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) {
      return;
    }

    try {
      await removeMemberMutation.mutateAsync(removeTarget.id);
      toast.success('Team member removed successfully.');
      setRemoveTarget(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to complete this action.'));
    }
  };

  const handleInvitationAction = async () => {
    if (!invitationAction) {
      return;
    }

    try {
      if (invitationAction.mode === 'revoke') {
        await revokeMutation.mutateAsync(invitationAction.id);
        toast.success('Invitation revoked successfully.');
      } else {
        await deleteInvitationMutation.mutateAsync(invitationAction.id);
        toast.success('Invitation deleted successfully.');
      }
      setInvitationAction(null);
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          invitationAction.mode === 'revoke'
            ? 'Unable to revoke the invitation.'
            : 'Unable to delete the invitation.'
        )
      );
    }
  };

  const handleQuickStatusChange = useCallback(async (member: TeamMember, status: 'active' | 'inactive') => {
    try {
      await updateMemberMutation.mutateAsync({
        memberId: member.id,
        role_title: member.role_title,
        status,
        permissions: normalizePermissions(member.permissions),
      });
      toast.success(`Team member ${status === 'active' ? 'activated' : 'deactivated'} successfully.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to update this team member.'));
    }
  }, [updateMemberMutation]);

  const handleResendInvitation = useCallback(async (invitationId: string) => {
    try {
      await resendMutation.mutateAsync(invitationId);
      toast.success('Invitation resent successfully.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to resend the invitation.'));
    }
  }, [resendMutation]);

  const memberColumns = useMemo<ColumnDef<TeamMember, unknown>[]>(() => [
    {
      accessorKey: 'member.email',
      header: 'Member',
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.original.member?.first_name} {row.original.member?.last_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.original.member?.email}</p>
        </div>
      ),
    },
    {
      accessorKey: 'role_title',
      header: 'Role Title',
      cell: ({ row }) => row.original.role_title,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'joined_at',
      header: 'Joined',
      cell: ({ row }) => row.original.joined_at ? new Date(row.original.joined_at).toLocaleDateString() : 'Pending',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          {canUpdate || canDelete ? (
            <>
              {canUpdate ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditMember(row.original);
                    setEditRoleTitle(row.original.role_title);
                    setEditStatus(row.original.status === 'inactive' ? 'inactive' : 'active');
                    setEditPermissions(normalizePermissions(row.original.permissions));
                  }}
                >
                  Edit
                </Button>
              ) : null}
              {canUpdate ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleQuickStatusChange(
                    row.original,
                    row.original.status === 'active' ? 'inactive' : 'active'
                  )}
                >
                  {row.original.status === 'active' ? 'Deactivate' : 'Activate'}
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRemoveTarget({ id: row.original.id, type: 'member' })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">View only</span>
          )}
        </div>
      ),
    },
  ], [canDelete, canUpdate, handleQuickStatusChange]);

  const invitationColumns = useMemo<ColumnDef<OrganizationInvitation, unknown>[]>(() => [
    {
      accessorKey: 'email',
      header: 'Invitee',
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.original.first_name} {row.original.last_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: 'role_title',
      header: 'Role Title',
      cell: ({ row }) => row.original.role_title,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
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
      header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            {['pending', 'revoked', 'expired'].includes(row.original.status) ? (
              <Button
                size="sm"
                variant="outline"
                disabled={!canCreate || isResendingInvitation}
                onClick={() => void handleResendInvitation(row.original.id)}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Resend
              </Button>
            ) : null}
            {row.original.status === 'pending' ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={!canDelete}
                onClick={() => setInvitationAction({ id: row.original.id, mode: 'revoke' })}
              >
                Revoke
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              disabled={!canDelete}
              onClick={() => setInvitationAction({ id: row.original.id, mode: 'delete' })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
  ], [canCreate, canDelete, handleResendInvitation, isResendingInvitation]);

  if (!canRead) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            You do not have permission to view team members in this organization.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
          <p className="text-sm text-muted-foreground">
            Manage organization members, reserved seats, invitations, and resource access.
          </p>
        </div>
        {canCreate ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openInviteDialog}>
              <Mail className="mr-2 h-4 w-4" />
              Invite by Email
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Create Team Account
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{activeMemberCount}</div>
            <p className="text-xs text-muted-foreground">Currently active in this organization</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{pendingInvitationCount}</div>
            <p className="text-xs text-muted-foreground">Reserved seats waiting for acceptance</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Available Seats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{availableSeats === null ? 'Unlimited' : availableSeats}</div>
            <p className="text-xs text-muted-foreground">
              {maxSeats === 0 ? 'No seat limit on the current plan' : `${seatsUsed}/${maxSeats} seats in use`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => updateTeamView(value === 'invitations' ? 'invitations' : 'members')}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="members">
            <Users className="mr-2 h-4 w-4" />
            Members
          </TabsTrigger>
          {canRead ? (
            <TabsTrigger value="invitations">
              <Mail className="mr-2 h-4 w-4" />
              Invitations
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardContent className="pt-6">
              <DataTable
                columns={memberColumns}
                data={members}
                isLoading={membersQuery.isLoading}
                page={memberMeta?.page ?? 1}
                totalPages={memberMeta?.totalPages ?? 1}
                total={memberMeta?.total}
                onPageChange={setMemberPage}
                emptyMessage="No team members found for this organization."
              />
            </CardContent>
          </Card>
        </TabsContent>

        {canRead ? (
          <TabsContent value="invitations">
            <Card>
              <CardContent className="pt-6">
                <DataTable
                  columns={invitationColumns}
                  data={invitations}
                  isLoading={invitationsQuery.isLoading}
                  page={invitationMeta?.page ?? 1}
                  totalPages={invitationMeta?.totalPages ?? 1}
                  total={invitationMeta?.total}
                  onPageChange={setInvitePage}
                  emptyMessage="No invitations have been sent yet."
                />
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Team Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={memberForm.first_name} onChange={(event) => setMemberForm((current) => ({ ...current, first_name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={memberForm.last_name} onChange={(event) => setMemberForm((current) => ({ ...current, last_name: event.target.value }))} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={memberForm.email} onChange={(event) => setMemberForm((current) => ({ ...current, email: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Role Title</Label>
                <Input value={memberForm.role_title} onChange={(event) => setMemberForm((current) => ({ ...current, role_title: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <Input
                type="password"
                value={memberForm.temporary_password}
                onChange={(event) => setMemberForm((current) => ({ ...current, temporary_password: event.target.value }))}
                placeholder="Minimum 8 characters with uppercase, lowercase, number, and symbol"
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <PermissionMatrix
                definitions={ORGANIZATION_ASSIGNABLE_RESOURCE_DEFINITIONS}
                value={memberForm.permissions}
                onChange={(permissions) => setMemberForm((current) => ({ ...current, permissions }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              disabled={
                createMemberMutation.isPending ||
                !memberForm.first_name.trim() ||
                !memberForm.last_name.trim() ||
                !memberForm.email.trim() ||
                !memberForm.role_title.trim() ||
                !memberForm.temporary_password.trim()
              }
              onClick={handleCreateMember}
            >
              {createMemberMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={(open) => (open ? openInviteDialog() : closeInviteDialog())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={inviteForm.first_name} onChange={(event) => setInviteForm((current) => ({ ...current, first_name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={inviteForm.last_name} onChange={(event) => setInviteForm((current) => ({ ...current, last_name: event.target.value }))} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Role Title</Label>
                <Input value={inviteForm.role_title} onChange={(event) => setInviteForm((current) => ({ ...current, role_title: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <PermissionMatrix
                definitions={ORGANIZATION_ASSIGNABLE_RESOURCE_DEFINITIONS}
                value={inviteForm.permissions}
                onChange={(permissions) => setInviteForm((current) => ({ ...current, permissions }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeInviteDialog}>Cancel</Button>
            <Button
              disabled={
                inviteMutation.isPending ||
                !inviteForm.first_name.trim() ||
                !inviteForm.last_name.trim() ||
                !inviteForm.email.trim() ||
                !inviteForm.role_title.trim()
              }
              onClick={handleInviteMember}
            >
              {inviteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editMember)} onOpenChange={(open) => (!open ? setEditMember(null) : null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role Title</Label>
                <Input value={editRoleTitle} onChange={(event) => setEditRoleTitle(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(value) => setEditStatus(value as 'active' | 'inactive')}>
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
            <div className="space-y-2">
              <Label>Permissions</Label>
              <PermissionMatrix
                definitions={ORGANIZATION_ASSIGNABLE_RESOURCE_DEFINITIONS}
                value={editPermissions}
                onChange={setEditPermissions}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>Cancel</Button>
            <Button
              disabled={updateMemberMutation.isPending || !editRoleTitle.trim()}
              onClick={handleUpdateMember}
            >
              {updateMemberMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removeTarget)} onOpenChange={(open) => (!open ? setRemoveTarget(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the membership record, revokes organization access, and unassigns any conversations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(invitationAction)} onOpenChange={(open) => (!open ? setInvitationAction(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {invitationAction?.mode === 'revoke' ? 'Revoke invitation?' : 'Delete invitation?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {invitationAction?.mode === 'revoke'
                ? 'This invitation will stop working immediately and you can resend it later to reopen it.'
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
