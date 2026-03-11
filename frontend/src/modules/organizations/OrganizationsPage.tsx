import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/shared/components/DataTable';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { getApiErrorMessage } from '@/core/errors/apiError';
import type { Organization, ApiResponse, PaginationMeta } from '@/core/types';
import { syncStoredOrganizationRegistry } from './context';
import { ACCESSIBLE_ORGANIZATIONS_QUERY_KEY } from './useOrganizationContext';

function useOrganizations(page = 1) {
  return useQuery<{ data: Organization[]; meta: PaginationMeta }>({
    queryKey: ['organizations', page],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Organization[]>>(`${ENDPOINTS.ORGANIZATIONS.BASE}?page=${page}&limit=20`);
      return { data: data.data, meta: data.meta! };
    },
  });
}

function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; description?: string; logo_url?: string }) => {
      const { data } = await apiClient.post<ApiResponse<Organization>>(ENDPOINTS.ORGANIZATIONS.BASE, body);
      return data.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['organizations'] });
      await qc.invalidateQueries({ queryKey: ACCESSIBLE_ORGANIZATIONS_QUERY_KEY });
    },
  });
}

export function OrganizationsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useOrganizations(page);
  const createOrg = useCreateOrg();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const orgs = data?.data ?? [];
  const meta = data?.meta;

  useEffect(() => {
    if (orgs.length) {
      syncStoredOrganizationRegistry(orgs);
    }
  }, [orgs]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const created = await createOrg.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        logo_url: logoUrl.trim() || undefined,
      });
      toast.success('Organization created');
      setCreateOpen(false);
      setName('');
      setDescription('');
      setLogoUrl('');
      navigate(`/organizations/${created.id}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to create organization.'));
    }
  };

  const columns = useMemo<ColumnDef<Organization, unknown>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Organization',
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
            <button className="truncate font-medium hover:underline" onClick={() => navigate(`/organizations/${row.original.id}`)}>
              {row.original.name}
            </button>
            <p className="truncate text-xs text-muted-foreground">{row.original.slug}</p>
          </div>
        </div>
      ),
    },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <Badge variant="secondary" className="text-xs capitalize">{getValue() as string}</Badge> },
    { accessorKey: 'created_at', header: 'Created', cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString() },
  ], [navigate]);

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
            <div className="space-y-2"><Label>Logo URL</Label><Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" /></div>
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
