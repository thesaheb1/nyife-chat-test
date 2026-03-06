import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from './useSubAdmins';
import type { AdminRole } from '../types';
import { toast } from 'sonner';

const ADMIN_RESOURCES = [
  'users', 'dashboard', 'plans', 'coupons', 'support',
  'sub_admins', 'notifications', 'settings', 'analytics', 'email',
];
const CRUD_OPS = ['create', 'read', 'update', 'delete'] as const;

export function RoleManagementPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: roles = [], isLoading } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const [editRole, setEditRole] = useState<AdminRole | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formPerms, setFormPerms] = useState<Record<string, Record<string, boolean>>>({});

  const initPerms = (role?: AdminRole) => {
    const perms: Record<string, Record<string, boolean>> = {};
    ADMIN_RESOURCES.forEach((res) => {
      perms[res] = {};
      CRUD_OPS.forEach((op) => {
        perms[res][op] = role?.permissions?.resources?.[res]?.[op] ?? false;
      });
    });
    return perms;
  };

  const openCreate = () => {
    setFormTitle('');
    setFormPerms(initPerms());
    setShowCreate(true);
    setEditRole(null);
  };

  const openEdit = (role: AdminRole) => {
    setFormTitle(role.title);
    setFormPerms(initPerms(role));
    setEditRole(role);
    setShowCreate(true);
  };

  const togglePerm = (resource: string, op: string) => {
    setFormPerms((prev) => ({
      ...prev,
      [resource]: { ...prev[resource], [op]: !prev[resource][op] },
    }));
  };

  const handleSave = async () => {
    if (!formTitle.trim()) return;
    const permissions = { resources: formPerms };
    try {
      if (editRole) {
        await updateRole.mutateAsync({ id: editRole.id, title: formTitle, permissions });
        toast.success('Role updated');
      } else {
        await createRole.mutateAsync({ title: formTitle, permissions });
        toast.success('Role created');
      }
      setShowCreate(false);
    } catch {
      toast.error('Failed to save role');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteRole.mutateAsync(deleteId);
      toast.success('Role deleted');
      setDeleteId(null);
    } catch {
      toast.error('Failed to delete role');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/sub-admins')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{t('admin.roles.title')}</h1>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.roles.createRole')}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : !roles.length ? (
        <p className="text-muted-foreground">{t('admin.roles.noRoles')}</p>
      ) : (
        <div className="space-y-4">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">{role.title}</CardTitle>
                  {role.is_system && <Badge variant="secondary">System</Badge>}
                </div>
                {!role.is_system && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(role)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(role.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(role.permissions?.resources ?? {}).map(([res, perms]) => {
                    const active = Object.entries(perms).filter(([, v]) => v).map(([k]) => k[0].toUpperCase());
                    if (!active.length) return null;
                    return (
                      <Badge key={res} variant="outline" className="text-xs">
                        {res}: {active.join('')}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog with Permission Matrix */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editRole ? t('admin.roles.editRole') : t('admin.roles.createRole')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('admin.roles.roleTitle')}</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>

            <div>
              <Label className="mb-2 block">{t('admin.roles.permissions')}</Label>
              <div className="rounded-md border overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left font-medium">{t('admin.roles.resource')}</th>
                      {CRUD_OPS.map((op) => (
                        <th key={op} className="p-2 text-center font-medium capitalize w-20">
                          {op}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ADMIN_RESOURCES.map((res) => (
                      <tr key={res} className="border-b">
                        <td className="p-2 capitalize">{res.replace(/_/g, ' ')}</td>
                        {CRUD_OPS.map((op) => (
                          <td key={op} className="p-2 text-center">
                            <Checkbox
                              checked={formPerms[res]?.[op] ?? false}
                              onCheckedChange={() => togglePerm(res, op)}
                            />
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
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={!formTitle.trim() || createRole.isPending || updateRole.isPending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>Sub-admins using this role will lose access.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
