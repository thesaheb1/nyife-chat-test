import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/shared/components/DataTable';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { sessionQueryKey } from '@/core/queryKeys';
import { getApiErrorMessage } from '@/core/errors/apiError';
import type { RootState } from '@/core/store';
import type { Organization, ApiResponse, PaginationMeta } from '@/core/types';
import {
  buildOrganizationNavigationTarget,
  setStoredActiveOrganization,
  syncStoredOrganizationRegistry,
} from './context';
import { accessibleOrganizationsQueryKey, useOrganizationContext } from './useOrganizationContext';

function useOrganizations(page = 1, userId?: string | null) {
  return useQuery<{ data: Organization[]; meta: PaginationMeta }>({
    queryKey: sessionQueryKey(['organizations', page] as const, userId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Organization[]>>(`${ENDPOINTS.ORGANIZATIONS.BASE}?page=${page}&limit=20`);
      return { data: data.data, meta: data.meta! };
    },
    enabled: Boolean(userId),
  });
}

function useCreateOrg(userId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; description?: string }) => {
      const { data } = await apiClient.post<ApiResponse<Organization>>(ENDPOINTS.ORGANIZATIONS.BASE, body);
      return data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['organizations'] });
      await qc.invalidateQueries({ queryKey: accessibleOrganizationsQueryKey(userId) });
    },
  });
}

export function OrganizationsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useOrganizations(page, userId);
  const createOrg = useCreateOrg(userId);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const orgs = data?.data ?? [];
  const meta = data?.meta;

  useEffect(() => {
    if (userId && orgs.length) {
      syncStoredOrganizationRegistry(userId, orgs);
    }
  }, [orgs, userId]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const created = await createOrg.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast.success('Organization created');
      setCreateOpen(false);
      setName('');
      setDescription('');
      navigate(`/organizations/${created.id}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to create organization.'));
    }
  };

  const handleSwitchOrganization = (organization: Organization) => {
    setStoredActiveOrganization(userId, organization);
    navigate(
      buildOrganizationNavigationTarget(
        organization.slug,
        location.pathname,
        location.search,
        location.hash
      )
    );
  };

  const columns = useMemo<ColumnDef<Organization, unknown>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.logo_url ? (
            <img
              src={row.original.logo_url}
              alt={row.original.name}
              className="h-8 w-8 rounded-md border object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted text-xs font-semibold uppercase text-muted-foreground">
              {row.original.name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <button
              className="truncate font-medium hover:underline"
              onClick={() => navigate(`/organizations/${row.original.id}`)}
            >
              {row.original.name}
            </button>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => row.original.description?.trim() || '\u2014',
    },
    {
      accessorKey: 'created_at',
      header: 'Created At',
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      accessorKey: 'updated_at',
      header: 'Updated At',
      cell: ({ row }) => new Date(row.original.updated_at).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const organization = row.original;
        const canEditOrganization = organization.organization_role === 'owner';
        const isActiveOrganization = activeOrganization?.id === organization.id;

        return (
          <div className="flex items-center gap-2">
            {canEditOrganization ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => navigate(`/organizations/${organization.id}`)}
              >
                Edit
              </Button>
            ) : null}
            <Button
              variant={isActiveOrganization ? 'secondary' : 'outline'}
              size="sm"
              className="h-8"
              onClick={() => handleSwitchOrganization(organization)}
            >
              Switch
            </Button>
          </div>
        );
      },
    },
  ], [activeOrganization?.id, location.hash, location.pathname, location.search, navigate, userId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Create Organization</Button>
      </div>

      <DataTable columns={columns} data={orgs} isLoading={isLoading} page={meta?.page ?? 1} totalPages={meta?.totalPages ?? 1} total={meta?.total} onPageChange={setPage} emptyMessage="No organizations yet." />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Organization</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Organization" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createOrg.isPending || !name.trim()}>
              {createOrg.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
