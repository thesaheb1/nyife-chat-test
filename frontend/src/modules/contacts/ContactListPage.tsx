import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Upload, Trash2 } from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DataTable } from '@/shared/components/DataTable';
import { useContacts, useTags, useBulkDeleteContacts } from './useContacts';
import { CreateContactDialog } from './CreateContactDialog';
import { useDebounce } from '@/core/hooks';
import type { Contact } from '@/core/types';

export function ContactListPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [tagFilter, setTagFilter] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data, isLoading } = useContacts({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    tag_id: tagFilter || undefined,
  });
  const { data: tags } = useTags();
  const bulkDelete = useBulkDeleteContacts();

  const contacts = data?.data?.contacts ?? [];
  const meta = data?.meta;

  const handleBulkDelete = async () => {
    const ids = selectedContacts.map((c) => c.id);
    try {
      const result = await bulkDelete.mutateAsync(ids);
      toast.success(`${result.deleted_count} contact(s) deleted`);
      setSelectedContacts([]);
      setBulkDeleteOpen(false);
    } catch {
      toast.error('Failed to delete contacts');
    }
  };

  const columns = useMemo<ColumnDef<Contact, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <button
            className="text-left font-medium hover:underline"
            onClick={() => navigate(`/contacts/${row.original.id}`)}
          >
            {row.original.name || row.original.whatsapp_name || '-'}
          </button>
        ),
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => (getValue() as string) || '-',
      },
      {
        id: 'tags',
        header: 'Tags',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.tags?.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                style={{ borderColor: tag.color, color: tag.color }}
                className="text-xs"
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ getValue }) => (
          <Badge variant="secondary" className="text-xs">
            {(getValue() as string).replace('_', ' ')}
          </Badge>
        ),
      },
      {
        accessorKey: 'last_messaged_at',
        header: 'Last Messaged',
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          return val ? new Date(val).toLocaleDateString() : '-';
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
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {meta?.total !== undefined ? `${meta.total} contacts` : 'Manage your contacts'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/contacts/import')}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name, phone, email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-9 w-64"
        />
        <Select
          value={tagFilter}
          onValueChange={(v) => {
            setTagFilter(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Filter by tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {tags?.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Bulk actions */}
        {selectedContacts.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete ({selectedContacts.length})
          </Button>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={contacts}
        isLoading={isLoading}
        page={meta?.page ?? 1}
        totalPages={meta?.totalPages ?? 1}
        total={meta?.total}
        onPageChange={setPage}
        enableSelection
        onSelectionChange={setSelectedContacts}
        emptyMessage="No contacts found. Add your first contact to get started."
      />

      {/* Create Dialog */}
      <CreateContactDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedContacts.length} contact(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The contacts will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
