import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Plus, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/shared/components/DataTable';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { getApiErrorMessage } from '@/core/errors/apiError';
import type { SupportTicket, ApiResponse, PaginationMeta } from '@/core/types';
import { buildOrganizationPath } from '@/modules/organizations/context';
import { useOrganizationContext } from '@/modules/organizations/useOrganizationContext';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  waiting_on_user: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-200 text-gray-700',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
};

export function SupportPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { activeOrganization } = useOrganizationContext();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const organizationId = activeOrganization?.id || 'global';

  const { data, isLoading } = useQuery<{ data: { tickets: SupportTicket[] }; meta: PaginationMeta }>({
    queryKey: ['tickets', organizationId, page, statusFilter],
    queryFn: async () => {
      const q = new URLSearchParams();
      q.set('page', String(page));
      q.set('limit', '20');
      if (statusFilter) q.set('status', statusFilter);
      const { data } = await apiClient.get<ApiResponse<{ tickets: SupportTicket[] }>>(`${ENDPOINTS.SUPPORT.TICKETS}?${q}`);
      return { data: data.data, meta: data.meta! };
    },
  });

  // Create ticket
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('technical');
  const [priority, setPriority] = useState('medium');
  const createTicket = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiResponse<{ ticket: SupportTicket }>>(ENDPOINTS.SUPPORT.TICKETS, { subject, description, category, priority });
      return data.data.ticket;
    },
    onSuccess: (ticket) => {
      toast.success('Ticket created');
      setCreateOpen(false);
      setSubject(''); setDescription('');
      qc.invalidateQueries({ queryKey: ['tickets', organizationId] });
      navigate(activeOrganization ? buildOrganizationPath(activeOrganization.slug, `/support/${ticket.id}`) : `/support/${ticket.id}`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to create the support ticket.')),
  });

  const tickets = data?.data?.tickets ?? [];
  const meta = data?.meta;

  const columns = useMemo<ColumnDef<SupportTicket, unknown>[]>(() => [
    {
      accessorKey: 'subject',
      header: 'Subject',
      cell: ({ row }) => (
        <button
          className="text-left font-medium hover:underline"
          onClick={() =>
            navigate(
              activeOrganization
                ? buildOrganizationPath(activeOrganization.slug, `/support/${row.original.id}`)
                : `/support/${row.original.id}`
            )
          }
        >
          <div>{row.original.subject}</div>
          <div className="text-[10px] text-muted-foreground">#{row.original.ticket_number}</div>
        </button>
      ),
    },
    { accessorKey: 'category', header: 'Category', cell: ({ getValue }) => <Badge variant="outline" className="text-xs capitalize">{getValue() as string}</Badge> },
    { accessorKey: 'priority', header: 'Priority', cell: ({ getValue }) => { const p = getValue() as string; return <Badge className={`${PRIORITY_COLORS[p]} text-xs`} variant="secondary">{p}</Badge>; } },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => { const s = getValue() as string; return <Badge className={`${STATUS_COLORS[s]} text-xs`} variant="secondary">{s.replace('_', ' ')}</Badge>; } },
    { accessorKey: 'created_at', header: 'Created', cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString() },
  ], [activeOrganization, navigate]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('support.title')}</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />{t('support.createTicket')}</Button>
      </div>

      <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
        <SelectTrigger className="h-9 w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="waiting_on_user">Waiting</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>

      <DataTable columns={columns} data={tickets} isLoading={isLoading} page={meta?.page ?? 1} totalPages={meta?.totalPages ?? 1} total={meta?.total} onPageChange={setPage} emptyMessage="No tickets for this organization." />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Support Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Subject *</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary of your issue" /></div>
            <div className="space-y-2"><Label>Description *</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your issue in detail" rows={4} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="account">Account</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createTicket.mutate()} disabled={createTicket.isPending || !subject.trim() || !description.trim()}>
              {createTicket.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
