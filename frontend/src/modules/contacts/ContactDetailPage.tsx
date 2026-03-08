import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Trash2, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useContact, useUpdateContact, useDeleteContact, useTags, useAddTagsToContact } from './useContacts';
import { updateContactSchema } from './validations';
import type { UpdateContactFormData } from './validations';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { useQueryClient } from '@tanstack/react-query';
import { PhoneNumberInput } from '@/shared/components/PhoneNumberInput';

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: contact, isLoading } = useContact(id);
  const updateContact = useUpdateContact(id!);
  const deleteContact = useDeleteContact();
  const { data: allTags } = useTags();
  const addTags = useAddTagsToContact();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [addTagId, setAddTagId] = useState('');

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<UpdateContactFormData>({
    resolver: zodResolver(updateContactSchema),
    values: contact
      ? {
          phone: contact.phone,
          name: contact.name,
          email: contact.email,
          company: contact.company,
          notes: contact.notes,
          opted_in: contact.opted_in,
        }
      : undefined,
  });

  const onSubmit = async (data: UpdateContactFormData) => {
    try {
      await updateContact.mutateAsync({
        ...data,
        phone: data.phone || undefined,
        email: data.email || undefined,
      });
      toast.success('Contact updated');
      setIsEditing(false);
    } catch (error) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update contact';
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteContact.mutateAsync(id!);
      toast.success('Contact deleted');
      navigate('/contacts');
    } catch {
      toast.error('Failed to delete contact');
    }
  };

  const handleAddTag = async () => {
    if (!addTagId) return;
    try {
      await addTags.mutateAsync({ contactId: id!, tagIds: [addTagId] });
      setAddTagId('');
      toast.success('Tag added');
    } catch {
      toast.error('Failed to add tag');
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await apiClient.delete(`${ENDPOINTS.CONTACTS.BASE}/${id}/tags/${tagId}`);
      qc.invalidateQueries({ queryKey: ['contact', id] });
      toast.success('Tag removed');
    } catch {
      toast.error('Failed to remove tag');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="py-12 text-center text-muted-foreground">Contact not found</div>
    );
  }

  const unassignedTags = allTags?.filter(
    (t) => !contact.tags?.some((ct) => ct.id === t.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/contacts')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{contact.name || contact.phone}</h1>
          <p className="text-sm text-muted-foreground">{contact.phone}</p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => { setIsEditing(false); reset(); }}>
                Cancel
              </Button>
              <Button onClick={handleSubmit(onSubmit)} disabled={updateContact.isPending}>
                {updateContact.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
              <Button variant="destructive" size="icon" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contact Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <form className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Controller
                      control={control}
                      name="phone"
                      render={({ field }) => (
                        <PhoneNumberInput
                          autoComplete="tel"
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          invalid={Boolean(errors.phone)}
                        />
                      )}
                    />
                    {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input {...register('name')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input {...register('email')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Input {...register('company')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea {...register('notes')} rows={3} />
                </div>
              </form>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone" value={contact.phone} />
                <Field label="Name" value={contact.name} />
                <Field label="Email" value={contact.email} />
                <Field label="Company" value={contact.company} />
                <Field label="Source" value={contact.source?.replace('_', ' ')} />
                <Field label="Opted In" value={contact.opted_in ? 'Yes' : 'No'} />
                <Field label="Messages" value={String(contact.message_count)} />
                <Field label="Last Messaged" value={contact.last_messaged_at ? new Date(contact.last_messaged_at).toLocaleDateString() : null} />
                {contact.notes && (
                  <div className="sm:col-span-2">
                    <Field label="Notes" value={contact.notes} />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {contact.tags?.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  style={{ borderColor: tag.color, color: tag.color }}
                  className="gap-1"
                >
                  {tag.name}
                  <button onClick={() => handleRemoveTag(tag.id)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {(!contact.tags || contact.tags.length === 0) && (
                <p className="text-sm text-muted-foreground">No tags</p>
              )}
            </div>
            {unassignedTags && unassignedTags.length > 0 && (
              <div className="flex gap-2">
                <Select value={addTagId} onValueChange={setAddTagId}>
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue placeholder="Add tag..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unassignedTags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={handleAddTag} disabled={!addTagId}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Groups */}
            <div className="mt-4 border-t pt-3">
              <p className="mb-2 text-sm font-medium">Groups</p>
              <div className="flex flex-wrap gap-2">
                {contact.groups?.map((group) => (
                  <Badge key={group.id} variant="secondary">
                    {group.name}
                  </Badge>
                ))}
                {(!contact.groups || contact.groups.length === 0) && (
                  <p className="text-sm text-muted-foreground">No groups</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {contact.name || contact.phone}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value || '-'}</p>
    </div>
  );
}
