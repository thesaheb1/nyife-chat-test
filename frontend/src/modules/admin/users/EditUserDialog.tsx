import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneNumberInput } from '@/shared/components/PhoneNumberInput';
import { useAuthenticatedImageSrc } from '@/shared/hooks/useAuthenticatedImageSrc';
import type { AdminUserListItem } from '../types';
import {
  useRemoveAdminUserAvatar,
  useUpdateAdminUser,
  useUploadAdminUserAvatar,
} from './useAdminUsers';
import { type UpdateUserFormData, updateUserSchema } from './validations';
import { getApiErrorMessage } from '@/core/errors/apiError';

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUserListItem;
}

function getInitials(user: Pick<AdminUserListItem, 'first_name' | 'last_name'>) {
  return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'U';
}

export function EditUserDialog({ open, onOpenChange, user }: EditUserDialogProps) {
  const updateUser = useUpdateAdminUser();
  const uploadAvatar = useUploadAdminUserAvatar();
  const removeAvatar = useRemoveAdminUserAvatar();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clearAvatar, setClearAvatar] = useState(false);
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | undefined>(undefined);
  const persistedAvatarSrc = useAuthenticatedImageSrc(user.avatar_url, user.updated_at);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone || '',
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone || '',
    });
    setSelectedFile(null);
    setClearAvatar(false);
    setSelectedFilePreview(undefined);
  }, [open, reset, user.email, user.first_name, user.last_name, user.phone]);

  useEffect(() => {
    if (!selectedFile) {
      setSelectedFilePreview(undefined);
      return undefined;
    }

    const previewUrl = URL.createObjectURL(selectedFile);
    setSelectedFilePreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [selectedFile]);

  const handleSave = async (values: UpdateUserFormData) => {
    try {
      await updateUser.mutateAsync({
        id: user.id,
        ...values,
        phone: values.phone || null,
      });

      if (clearAvatar && user.avatar_url) {
        await removeAvatar.mutateAsync(user.id);
      }

      if (selectedFile) {
        await uploadAvatar.mutateAsync({ id: user.id, file: selectedFile });
      }

      toast.success('User profile updated.');
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update the user profile.'));
    }
  };

  const isBusy =
    isSubmitting
    || updateUser.isPending
    || uploadAvatar.isPending
    || removeAvatar.isPending;
  const avatarPreviewSrc = clearAvatar ? undefined : selectedFilePreview || persistedAvatarSrc;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update profile details, upload a new avatar, or remove the existing image.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit(handleSave)}>
          <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarPreviewSrc} alt={user.email} className="object-cover" />
              <AvatarFallback>{getInitials(user)}</AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-2">
              <div className="text-sm font-medium">{user.first_name} {user.last_name}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
              {selectedFile ? (
                <div className="text-xs text-muted-foreground">
                  New avatar selected: <span className="font-medium text-foreground">{selectedFile.name}</span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById(`user-avatar-upload-${user.id}`)?.click()}
                disabled={isBusy}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Avatar
              </Button>
              {(user.avatar_url || selectedFile) ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    setSelectedFile(null);
                    setClearAvatar(true);
                  }}
                  disabled={isBusy}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove Avatar
                </Button>
              ) : null}
              <input
                id={`user-avatar-upload-${user.id}`}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setSelectedFile(file);
                  setClearAvatar(false);
                }}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-first-name">First name</Label>
              <Input id="edit-first-name" {...register('first_name')} />
              {errors.first_name ? (
                <p className="text-xs text-destructive">{errors.first_name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-last-name">Last name</Label>
              <Input id="edit-last-name" {...register('last_name')} />
              {errors.last_name ? (
                <p className="text-xs text-destructive">{errors.last_name.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" type="email" {...register('email')} />
            {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <PhoneNumberInput
                  id="edit-phone"
                  autoComplete="tel"
                  value={field.value || ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={Boolean(errors.phone)}
                />
              )}
            />
            {errors.phone ? <p className="text-xs text-destructive">{errors.phone.message}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
              Cancel
            </Button>
            <Button type="submit" disabled={isBusy}>
              {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
