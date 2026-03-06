import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { useSubAdmins, useCreateSubAdmin, useDeleteSubAdmin, useRoles } from './useSubAdmins';
import type { SubAdmin } from '../types';
import { toast } from 'sonner';

const columns: ColumnDef<SubAdmin>[] = [
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
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.role?.title ?? row.original.role_id}</Badge>
    ),
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
      row.original.last_login_at
        ? new Date(row.original.last_login_at).toLocaleString()
        : 'Never',
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
  },
];

export function SubAdminListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: subAdmins = [], isLoading } = useSubAdmins();
  const { data: roles = [] } = useRoles();
  const createSubAdmin = useCreateSubAdmin();
  const deleteSubAdmin = useDeleteSubAdmin();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newUserId, setNewUserId] = useState('');
  const [newRoleId, setNewRoleId] = useState('');

  const handleCreate = async () => {
    if (!newUserId || !newRoleId) return;
    try {
      await createSubAdmin.mutateAsync({ user_id: newUserId, role_id: newRoleId });
      toast.success('Sub-admin created');
      setShowCreate(false);
      setNewUserId('');
      setNewRoleId('');
    } catch {
      toast.error('Failed to create sub-admin');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSubAdmin.mutateAsync(deleteId);
      toast.success('Sub-admin removed');
      setDeleteId(null);
    } catch {
      toast.error('Failed to remove sub-admin');
    }
  };

  const columnsWithActions: ColumnDef<SubAdmin>[] = [
    ...columns,
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setDeleteId(row.original.id); }}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('admin.subAdmins.title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/sub-admins/roles')}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            {t('admin.roles.title')}
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('admin.subAdmins.createSubAdmin')}
          </Button>
        </div>
      </div>

      <DataTable columns={columnsWithActions} data={subAdmins} isLoading={isLoading} />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.subAdmins.createSubAdmin')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>User ID (email or UUID)</Label>
              <Input value={newUserId} onChange={(e) => setNewUserId(e.target.value)} placeholder="Enter user ID or email" />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.subAdmins.role')}</Label>
              <Select value={newRoleId} onValueChange={setNewRoleId}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>{role.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={!newUserId || !newRoleId || createSubAdmin.isPending}>
              {createSubAdmin.isPending ? 'Creating...' : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Sub-Admin</AlertDialogTitle>
            <AlertDialogDescription>This will revoke their admin access.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
