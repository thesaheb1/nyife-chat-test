import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, RefreshCw, Loader2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/shared/components/DataTable';
import { useTemplates, useSyncTemplates } from './useTemplates';
import { useDebounce } from '@/core/hooks';
import type { Template } from '@/core/types';

const STATUS_COLORS: Record<Template['status'], string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  paused: 'bg-orange-100 text-orange-800',
  disabled: 'bg-gray-300 text-gray-700',
};

const TYPE_LABELS: Record<Template['type'], string> = {
  standard: 'Standard',
  authentication: 'Authentication',
  carousel: 'Carousel',
  flow: 'Flow',
  list_menu: 'List Menu',
};

export function TemplateListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [syncOpen, setSyncOpen] = useState(false);
  const [wabaId, setWabaId] = useState('');

  const { data, isLoading } = useTemplates({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
    type: typeFilter || undefined,
  });

  const syncTemplates = useSyncTemplates();

  const templates = data?.data?.templates ?? [];
  const meta = data?.meta;

  const handleSync = async () => {
    if (!wabaId.trim()) return;
    try {
      const result = await syncTemplates.mutateAsync(wabaId.trim());
      toast.success(`Synced ${result.synced} templates (${result.created} created, ${result.updated} updated)`);
      setSyncOpen(false);
      setWabaId('');
    } catch {
      toast.error('Failed to sync templates');
    }
  };

  const columns = useMemo<ColumnDef<Template, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <button
            className="text-left font-medium hover:underline"
            onClick={() => navigate(`/templates/${row.original.id}`)}
          >
            <div>{row.original.display_name || row.original.name}</div>
            {row.original.display_name && (
              <div className="text-xs text-muted-foreground">{row.original.name}</div>
            )}
          </button>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ getValue }) => (
          <Badge variant="outline" className="text-xs">
            {getValue() as string}
          </Badge>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ getValue }) => TYPE_LABELS[getValue() as Template['type']],
      },
      {
        accessorKey: 'language',
        header: 'Language',
        cell: ({ getValue }) => (
          <span className="text-sm">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as Template['status'];
          return (
            <Badge className={`${STATUS_COLORS[status]} text-xs`} variant="secondary">
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
      },
    ],
    [navigate]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">
            {meta?.total !== undefined ? `${meta.total} templates` : 'Manage your WhatsApp message templates'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSyncOpen(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync from Meta
          </Button>
          <Button size="sm" onClick={() => navigate('/templates/create')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-9 w-64"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={categoryFilter}
          onValueChange={(v) => {
            setCategoryFilter(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="MARKETING">Marketing</SelectItem>
            <SelectItem value="UTILITY">Utility</SelectItem>
            <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="authentication">Authentication</SelectItem>
            <SelectItem value="carousel">Carousel</SelectItem>
            <SelectItem value="flow">Flow</SelectItem>
            <SelectItem value="list_menu">List Menu</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={templates}
        isLoading={isLoading}
        page={meta?.page ?? 1}
        totalPages={meta?.totalPages ?? 1}
        total={meta?.total}
        onPageChange={setPage}
        emptyMessage="No templates found. Create your first template to get started."
      />

      {/* Sync Dialog */}
      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sync Templates from Meta</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>WABA ID</Label>
            <Input
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              placeholder="Enter WhatsApp Business Account ID"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSync} disabled={syncTemplates.isPending || !wabaId.trim()}>
              {syncTemplates.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sync
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
