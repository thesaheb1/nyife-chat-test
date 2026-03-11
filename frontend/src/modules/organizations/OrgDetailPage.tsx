import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Save, Trash2, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DataTable } from '@/shared/components/DataTable';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { getApiErrorMessage } from '@/core/errors/apiError';
import type { Organization, TeamMember, ApiResponse, PaginationMeta } from '@/core/types';
import {
  getStoredActiveOrganizationId,
  resolvePreferredOrganization,
  setStoredActiveOrganization,
  syncStoredOrganizationRegistry,
} from './context';
import { ACCESSIBLE_ORGANIZATIONS_QUERY_KEY } from './useOrganizationContext';

function useOrg(id: string | undefined) {
  return useQuery<Organization>({
    queryKey: ['organizations', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ organization: Organization }>>(`${ENDPOINTS.ORGANIZATIONS.BASE}/${id}`);
      return data.data.organization;
    },
    enabled: !!id,
  });
}

function useMembers(orgId: string | undefined, page = 1) {
  return useQuery<{ data: { members: TeamMember[] }; meta: PaginationMeta }>({
    queryKey: ['organizations', orgId, 'members', page],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ members: TeamMember[] }>>(`${ENDPOINTS.ORGANIZATIONS.BASE}/${orgId}/members?page=${page}&limit=20`);
      return { data: data.data, meta: data.meta! };
    },
    enabled: !!orgId,
  });
}

const RESOURCES = [
  'dashboard',
  'contacts',
  'templates',
  'flows',
  'campaigns',
  'automations',
  'chat',
  'wallet',
  'support',
  'analytics',
  'settings',
  'billing',
  'subscription',
  'organizations',
  'team_members',
  'whatsapp',
  'developer',
] as const;
const ACTIONS = ['create', 'read', 'update', 'delete'] as const;

export function OrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: org, isLoading } = useOrg(id);
  const [memberPage, setMemberPage] = useState(1);
  const { data: membersData, isLoading: membersLoading } = useMembers(id, memberPage);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [orgLogoUrl, setOrgLogoUrl] = useState('');
  const [savingOrg, setSavingOrg] = useState(false);

  // Invite form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [perms, setPerms] = useState<Record<string, Record<string, boolean>>>(() => {
    const p: Record<string, Record<string, boolean>> = {};
    RESOURCES.forEach((r) => { p[r] = { create: false, read: true, update: false, delete: false }; });
    return p;
  });
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!org) {
      return;
    }

    setOrgName(org.name);
    setOrgDescription(org.description || '');
    setOrgLogoUrl(org.logo_url || '');
  }, [org]);

  const togglePerm = (resource: string, action: string) => {
    setPerms((prev) => ({
      ...prev,
      [resource]: { ...prev[resource], [action]: !prev[resource][action] },
    }));
  };

  const handleInvite = async () => {
    if (!id) return;
    setInviting(true);
    try {
      await apiClient.post(`${ENDPOINTS.ORGANIZATIONS.BASE}/${id}/members`, {
        first_name: firstName, last_name: lastName, email, role_title: roleTitle,
        permissions: { resources: perms },
      });
      toast.success('Team member invited');
      setInviteOpen(false);
      setFirstName(''); setLastName(''); setEmail(''); setRoleTitle('');
      qc.invalidateQueries({ queryKey: ['organizations', id, 'members'] });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to invite the team member.'));
    }
    setInviting(false);
  };

  const handleOrganizationSave = async () => {
    if (!id) {
      return;
    }

    setSavingOrg(true);
    try {
      const { data } = await apiClient.put<ApiResponse<Organization>>(
        `${ENDPOINTS.ORGANIZATIONS.BASE}/${id}`,
        {
          name: orgName.trim(),
          description: orgDescription.trim() || undefined,
          logo_url: orgLogoUrl.trim() || undefined,
        }
      );

      const updatedOrganization = data.data;
      toast.success('Organization updated');
      qc.invalidateQueries({ queryKey: ['organizations', id] });
      qc.invalidateQueries({ queryKey: ['organizations'] });
      qc.invalidateQueries({ queryKey: ACCESSIBLE_ORGANIZATIONS_QUERY_KEY });

      const cachedAccessibleOrganizations =
        qc.getQueryData<Organization[]>(ACCESSIBLE_ORGANIZATIONS_QUERY_KEY) || [];

      const organizations = cachedAccessibleOrganizations.length
        ? (
            cachedAccessibleOrganizations.some((organization) => organization.id === updatedOrganization.id)
              ? cachedAccessibleOrganizations.map((organization) =>
                  organization.id === updatedOrganization.id ? { ...organization, ...updatedOrganization } : organization
                )
              : [...cachedAccessibleOrganizations, updatedOrganization]
          )
        : [updatedOrganization];

      syncStoredOrganizationRegistry(organizations);

      if ((getStoredActiveOrganizationId() || updatedOrganization.id) === updatedOrganization.id) {
        const activeOrganization = resolvePreferredOrganization(organizations, updatedOrganization.slug) || updatedOrganization;
        setStoredActiveOrganization(activeOrganization);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update the organization.'));
    } finally {
      setSavingOrg(false);
    }
  };

  const handleRemove = async () => {
    if (!id || !removeId) return;
    try {
      await apiClient.delete(`${ENDPOINTS.ORGANIZATIONS.BASE}/${id}/members/${removeId}`);
      toast.success('Member removed');
      qc.invalidateQueries({ queryKey: ['organizations', id, 'members'] });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to remove the team member.'));
    }
    setRemoveId(null);
  };

  const members = membersData?.data?.members ?? [];
  const memberMeta = membersData?.meta;

  const memberColumns = useMemo<ColumnDef<TeamMember, unknown>[]>(() => [
    {
      id: 'member',
      header: 'Member',
      cell: ({ row }) => {
        const member = row.original.member;
        const fullName = [member?.first_name, member?.last_name].filter(Boolean).join(' ').trim();
        return (
          <div className="space-y-1">
            <p className="font-medium">{fullName || row.original.member_user_id.slice(0, 8)}</p>
            <p className="text-xs text-muted-foreground">{member?.email || row.original.member_user_id}</p>
          </div>
        );
      },
    },
    { accessorKey: 'role_title', header: 'Role' },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge variant="secondary" className="text-xs capitalize">{getValue() as string}</Badge> },
    { accessorKey: 'created_at', header: 'Invited', cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString() },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRemoveId(row.original.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      ),
    },
  ], []);

  if (isLoading) return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32" /></div>;
  if (!org) return <div className="py-12 text-center text-muted-foreground">Organization not found.</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/organizations')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
          {org.description && <p className="text-sm text-muted-foreground">{org.description}</p>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Organization Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[96px_1fr]">
            <div className="flex justify-center sm:justify-start">
              {orgLogoUrl ? (
                <img
                  src={orgLogoUrl}
                  alt={orgName || org.name}
                  className="h-24 w-24 rounded-xl border object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-xl border bg-muted text-3xl font-semibold uppercase text-muted-foreground">
                  {(orgName || org.name).slice(0, 1)}
                </div>
              )}
            </div>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={orgName} onChange={(event) => setOrgName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={orgDescription}
                  onChange={(event) => setOrgDescription(event.target.value)}
                  placeholder="Describe this organization"
                />
              </div>
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input
                  value={orgLogoUrl}
                  onChange={(event) => setOrgLogoUrl(event.target.value)}
                  placeholder="https://example.com/logo.png"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleOrganizationSave}
              disabled={savingOrg || !orgName.trim()}
            >
              {savingOrg ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Organization
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Team Members</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(`/org/${org.slug}/team`)}>
                Manage Team
              </Button>
              <Button size="sm" onClick={() => setInviteOpen(true)}><Plus className="mr-2 h-4 w-4" />Invite</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={memberColumns} data={members} isLoading={membersLoading} page={memberMeta?.page ?? 1} totalPages={memberMeta?.totalPages ?? 1} total={memberMeta?.total} onPageChange={setMemberPage} emptyMessage="No team members yet." />
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>First Name *</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Last Name *</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label>Role Title *</Label><Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="e.g., Chat Agent" /></div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="rounded border overflow-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b bg-muted"><th className="p-2 text-left">Resource</th>{ACTIONS.map((a) => <th key={a} className="p-2 text-center capitalize">{a}</th>)}</tr></thead>
                  <tbody>
                    {RESOURCES.map((r) => (
                      <tr key={r} className="border-b">
                        <td className="p-2 capitalize">{r}</td>
                        {ACTIONS.map((a) => (
                          <td key={a} className="p-2 text-center">
                            <Checkbox checked={perms[r]?.[a] ?? false} onCheckedChange={() => togglePerm(r, a)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting || !firstName || !lastName || !email || !roleTitle}>
              {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirm */}
      <AlertDialog open={!!removeId} onOpenChange={() => setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove member?</AlertDialogTitle><AlertDialogDescription>This member will lose access to the organization.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
