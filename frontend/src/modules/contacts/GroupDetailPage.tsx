import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Trash2, UserMinus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useGroup, useRemoveGroupMembers, useDeleteGroup } from './useContacts';
import type { Contact } from '@/core/types';

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useGroup(id);
  const removeMembers = useRemoveGroupMembers();
  const deleteGroup = useDeleteGroup();
  const [selectedMembers, setSelectedMembers] = useState<Contact[]>([]);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleRemoveMembers = async () => {
    const ids = selectedMembers.map((c) => c.id);
    try {
      await removeMembers.mutateAsync({ groupId: id!, contactIds: ids });
      toast.success(`${ids.length} member(s) removed`);
      setSelectedMembers([]);
      setRemoveOpen(false);
    } catch {
      toast.error('Failed to remove members');
    }
  };

  const handleDeleteGroup = async () => {
    try {
      await deleteGroup.mutateAsync(id!);
      toast.success('Group deleted');
      navigate('/contacts/groups');
    } catch {
      toast.error('Failed to delete group');
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
            {row.original.name || row.original.phone}
          </button>
        ),
      },
      { accessorKey: 'phone', header: 'Phone' },
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
    ],
    [navigate]
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return <div className="py-12 text-center text-muted-foreground">Group not found</div>;
  }

  const { group, members } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/contacts/groups')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{group.name}</h1>
            <Badge variant="secondary">{group.type}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {group.contact_count} members
            {group.description && ` — ${group.description}`}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedMembers.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setRemoveOpen(true)}>
              <UserMinus className="mr-2 h-4 w-4" />
              Remove ({selectedMembers.length})
            </Button>
          )}
          <Button variant="destructive" size="icon" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Members Table */}
      <DataTable
        columns={columns}
        data={members}
        enableSelection
        onSelectionChange={setSelectedMembers}
        emptyMessage="No members in this group yet."
      />

      {/* Remove Members Confirmation */}
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedMembers.length} member(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be removed from this group but not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMembers}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Group Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group "{group.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The group will be deleted. Contacts will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
