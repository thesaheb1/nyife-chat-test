import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  ADMIN_ASSIGNABLE_RESOURCE_DEFINITIONS,
  buildPermissionMap,
  normalizePermissionMap,
} from '@/core/permissions/catalog';
import { PermissionMatrix } from '@/shared/components/PermissionMatrix';

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
  const [formPerms, setFormPerms] = useState(buildPermissionMap(ADMIN_ASSIGNABLE_RESOURCE_DEFINITIONS.map((resource) => resource.key), false));

  const openCreate = () => {
    setFormTitle('');
    setFormPerms(buildPermissionMap(ADMIN_ASSIGNABLE_RESOURCE_DEFINITIONS.map((resource) => resource.key), false));
    setShowCreate(true);
    setEditRole(null);
  };

  const openEdit = (role: AdminRole) => {
    setFormTitle(role.title);
    setFormPerms(normalizePermissionMap(role.permissions, ADMIN_ASSIGNABLE_RESOURCE_DEFINITIONS));
    setEditRole(role);
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) return;
    try {
      if (editRole) {
        await updateRole.mutateAsync({
          id: editRole.id,
          title: formTitle,
          ...(editRole.is_system ? {} : { permissions: formPerms }),
        });
        toast.success('Role updated');
      } else {
        await createRole.mutateAsync({ title: formTitle, permissions: formPerms });
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
                <PermissionMatrix
                  definitions={ADMIN_ASSIGNABLE_RESOURCE_DEFINITIONS}
                  value={formPerms}
                  onChange={setFormPerms}
                  disabled={Boolean(editRole?.is_system)}
                />
              </div>
              {editRole?.is_system ? (
                <p className="text-xs text-muted-foreground">
                  System roles keep their permissions fixed. Only the title can be updated.
                </p>
              ) : null}
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
