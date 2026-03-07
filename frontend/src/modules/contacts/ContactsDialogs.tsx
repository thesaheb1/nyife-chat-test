import { ChevronLeft, ChevronRight, Loader2, Pencil, Trash2, UserMinus, UserPlus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import type { Contact, Group, PaginationMeta, Tag } from '@/core/types';

export function TagManagerDialog(props: {
  open: boolean;
  tags: Tag[];
  editingTagId: string | null;
  tagFormName: string;
  tagFormColor: string;
  isSaving: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onEditTag: (tag: Tag) => void;
  onReset: () => void;
  onTagFormNameChange: (value: string) => void;
  onTagFormColorChange: (value: string) => void;
  onSubmit: () => void;
  onDelete: (tagId: string) => Promise<void>;
}) {
  const {
    open,
    tags,
    editingTagId,
    tagFormName,
    tagFormColor,
    isSaving,
    isDeleting,
    onOpenChange,
    onEditTag,
    onReset,
    onTagFormNameChange,
    onTagFormColorChange,
    onSubmit,
    onDelete,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription>Create reusable labels for categorization and filtering.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">{editingTagId ? 'Edit Tag' : 'Create Tag'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={tagFormName} onChange={(event) => onTagFormNameChange(event.target.value)} placeholder="VIP" />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <Input type="color" value={tagFormColor} onChange={(event) => onTagFormColorChange(event.target.value)} className="h-10 w-16 p-1" />
                  <Input value={tagFormColor} onChange={(event) => onTagFormColorChange(event.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={onSubmit} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingTagId ? 'Update Tag' : 'Create Tag'}
                </Button>
                {editingTagId && (
                  <Button variant="outline" onClick={onReset}>
                    Cancel Edit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Existing Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[360px] pr-3">
                <div className="space-y-3">
                  {tags.length ? tags.map((tag) => (
                    <div key={tag.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: tag.color }} />
                        <div>
                          <div className="font-medium">{tag.name}</div>
                          <div className="text-xs text-muted-foreground">{tag.contact_count ?? 0} contact(s)</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onEditTag(tag)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" disabled={isDeleting} onClick={() => onDelete(tag.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No tags yet.</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BulkTagDialog(props: {
  open: boolean;
  mode: 'assign' | 'remove';
  selectedCount: number;
  tags: Tag[];
  selectedTagIds: string[];
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleTag: (tagId: string, checked: boolean) => void;
  onSubmit: () => void;
}) {
  const { open, mode, selectedCount, tags, selectedTagIds, loading, onOpenChange, onToggleTag, onSubmit } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === 'assign' ? 'Assign Tags' : 'Remove Tags'}</DialogTitle>
          <DialogDescription>
            {mode === 'assign'
              ? `Apply one or more tags to ${selectedCount} selected contact(s).`
              : `Remove one or more tags from ${selectedCount} selected contact(s).`}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[340px] pr-3">
          <div className="space-y-2">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Checkbox checked={selectedTagIds.includes(tag.id)} onCheckedChange={(checked) => onToggleTag(tag.id, checked === true)} />
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: tag.color }} />
                <div>
                  <div className="font-medium">{tag.name}</div>
                  <div className="text-xs text-muted-foreground">{tag.contact_count ?? 0} tagged contact(s)</div>
                </div>
              </label>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'assign' ? 'Apply Tags' : 'Remove Tags'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BulkGroupDialog(props: {
  open: boolean;
  mode: 'assign' | 'remove';
  selectedCount: number;
  groups: Group[];
  selectedGroupIds: string[];
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleGroup: (groupId: string, checked: boolean) => void;
  onSubmit: () => void;
}) {
  const { open, mode, selectedCount, groups, selectedGroupIds, loading, onOpenChange, onToggleGroup, onSubmit } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === 'assign' ? 'Assign Groups' : 'Remove Groups'}</DialogTitle>
          <DialogDescription>
            {mode === 'assign'
              ? `Assign ${selectedCount} selected contact(s) to one or more groups.`
              : `Remove ${selectedCount} selected contact(s) from one or more groups.`}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[340px] pr-3">
          <div className="space-y-2">
            {groups.map((group) => (
              <label key={group.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Checkbox checked={selectedGroupIds.includes(group.id)} onCheckedChange={(checked) => onToggleGroup(group.id, checked === true)} />
                  <div>
                    <div className="font-medium">{group.name}</div>
                    <div className="text-xs text-muted-foreground">{group.contact_count} member(s)</div>
                  </div>
                </div>
                <Badge variant="secondary">{group.type}</Badge>
              </label>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'assign' ? 'Assign Groups' : 'Remove Groups'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GroupEditorDialog(props: {
  open: boolean;
  mode: 'create' | 'edit';
  contacts: Contact[];
  contactsMeta?: PaginationMeta;
  contactsPage: number;
  contactsLoading: boolean;
  saving: boolean;
  selectedContactIds: string[];
  name: string;
  description: string;
  contactSearch: string;
  onOpenChange: (open: boolean) => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onContactSearchChange: (value: string) => void;
  onContactsPageChange: (page: number) => void;
  onToggleContact: (contactId: string, checked: boolean) => void;
  onSubmit: () => void;
}) {
  const {
    open,
    mode,
    contacts,
    contactsMeta,
    contactsPage,
    contactsLoading,
    saving,
    selectedContactIds,
    name,
    description,
    contactSearch,
    onOpenChange,
    onNameChange,
    onDescriptionChange,
    onContactSearchChange,
    onContactsPageChange,
    onToggleContact,
    onSubmit,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] p-0 sm:max-w-4xl">
        <DialogHeader>
          <div className="border-b bg-gradient-to-br from-emerald-50 via-background to-sky-50 px-6 py-5">
            <DialogTitle>{mode === 'create' ? 'Create Group' : 'Edit Group'}</DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? 'Create the group first, then add members now or later. Member selection is optional.'
                : 'Update the group details. Membership can still be managed later from the group actions.'}
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="grid gap-6 px-6 pb-6 pt-2 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="border-border/60 shadow-sm">
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Newsletter Subscribers" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(event) => onDescriptionChange(event.target.value)} rows={5} placeholder="Internal notes for this group" />
              </div>
              {mode === 'create' && (
                <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Add contacts now if you want the segment to be campaign-ready immediately. You can also leave this empty and add members later.
                </div>
              )}
            </CardContent>
          </Card>
          {mode === 'create' ? (
            <div className="space-y-3">
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base">Contacts</CardTitle>
                      <p className="text-sm text-muted-foreground">Optional. Search and attach members while creating the group.</p>
                    </div>
                    <Badge variant="secondary">{selectedContactIds.length} selected</Badge>
                  </div>
                  <Input value={contactSearch} onChange={(event) => onContactSearchChange(event.target.value)} placeholder="Search contacts by name, email, or phone" />
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-[300px] rounded-xl border bg-muted/10 p-3">
                    <div className="space-y-2">
                      {contactsLoading ? (
                        <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted-foreground">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading contacts
                        </div>
                      ) : contacts.length ? contacts.map((contact) => (
                        <label key={contact.id} className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3">
                          <div className="flex items-center gap-3">
                            <Checkbox checked={selectedContactIds.includes(contact.id)} onCheckedChange={(checked) => onToggleContact(contact.id, checked === true)} />
                            <div>
                              <div className="font-medium">{contact.name || contact.phone}</div>
                              <div className="text-xs text-muted-foreground">{contact.phone}</div>
                            </div>
                          </div>
                          {contact.groups?.length ? (
                            <Badge variant="outline" className="hidden sm:inline-flex">
                              {contact.groups.length} group(s)
                            </Badge>
                          ) : null}
                        </label>
                      )) : (
                        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                          No contacts matched this search. You can still create the group now and add members later.
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  {contactsMeta && contactsMeta.totalPages > 1 && (
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">
                        Page {contactsPage} of {contactsMeta.totalPages}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onContactsPageChange(contactsPage - 1)}
                          disabled={contactsPage <= 1 || contactsLoading}
                        >
                          <ChevronLeft className="mr-2 h-4 w-4" />
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onContactsPageChange(contactsPage + 1)}
                          disabled={contactsPage >= contactsMeta.totalPages || contactsLoading}
                        >
                          Next
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              Use the group actions to add or remove members when needed. The group can exist without members.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Create Group' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GroupContactsDialog(props: {
  open: boolean;
  mode: 'assign' | 'remove';
  groups: Group[];
  contacts: Contact[];
  contactsMeta?: PaginationMeta;
  contactsPage: number;
  selectedContactIds: string[];
  contactSearch: string;
  contactsLoading: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onContactSearchChange: (value: string) => void;
  onContactsPageChange: (page: number) => void;
  onToggleContact: (contactId: string, checked: boolean) => void;
  onSubmit: () => void;
}) {
  const {
    open,
    mode,
    groups,
    contacts,
    contactsMeta,
    contactsPage,
    selectedContactIds,
    contactSearch,
    contactsLoading,
    saving,
    onOpenChange,
    onContactSearchChange,
    onContactsPageChange,
    onToggleContact,
    onSubmit,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{mode === 'assign' ? 'Add Contacts to Groups' : 'Remove Contacts from Groups'}</DialogTitle>
          <DialogDescription>
            {groups.length
              ? `${mode === 'assign' ? 'Update memberships for' : 'Remove memberships from'} ${groups.map((group) => group.name).join(', ')}`
              : 'Select a group first.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <Badge key={group.id} variant="secondary">
                {group.name}
              </Badge>
            ))}
          </div>
          <Input value={contactSearch} onChange={(event) => onContactSearchChange(event.target.value)} placeholder="Search contacts" />
          <ScrollArea className="h-[340px] rounded-lg border p-3">
            <div className="space-y-2">
              {contactsLoading ? (
                <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading contacts
                </div>
              ) : contacts.length ? contacts.map((contact) => (
                <label key={contact.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={selectedContactIds.includes(contact.id)} onCheckedChange={(checked) => onToggleContact(contact.id, checked === true)} />
                    <div>
                      <div className="font-medium">{contact.name || contact.phone}</div>
                      <div className="text-xs text-muted-foreground">{contact.phone}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {contact.groups?.slice(0, 2).map((group) => (
                      <Badge key={group.id} variant="outline" className="text-xs">
                        {group.name}
                      </Badge>
                    ))}
                  </div>
                </label>
              )) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No contacts matched the current search.
                </div>
              )}
            </div>
          </ScrollArea>
          {contactsMeta && contactsMeta.totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                Page {contactsPage} of {contactsMeta.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onContactsPageChange(contactsPage - 1)}
                  disabled={contactsPage <= 1 || contactsLoading}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onContactsPageChange(contactsPage + 1)}
                  disabled={contactsPage >= contactsMeta.totalPages || contactsLoading}
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'assign' ? 'Update Memberships' : 'Remove Memberships'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GroupDetailDialog(props: {
  open: boolean;
  group: Group | null;
  members: Contact[];
  meta?: PaginationMeta;
  loading: boolean;
  selectedContactIds: string[];
  onOpenChange: (open: boolean) => void;
  onPageChange: (page: number) => void;
  onToggleContact: (contactId: string, checked: boolean) => void;
  onEdit: () => void;
  onAddMembers: () => void;
  onRemoveMembers: () => void;
  onDelete: () => void;
  onOpenContact: (contactId: string) => void;
}) {
  const {
    open,
    group,
    members,
    meta,
    loading,
    selectedContactIds,
    onOpenChange,
    onPageChange,
    onToggleContact,
    onEdit,
    onAddMembers,
    onRemoveMembers,
    onDelete,
    onOpenContact,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] p-0 sm:max-w-5xl">
        <DialogHeader>
          <div className="border-b bg-gradient-to-br from-emerald-50 via-background to-sky-50 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <DialogTitle>{group?.name || 'Group details'}</DialogTitle>
                <DialogDescription>
                  {group?.description || 'Review this group and manage membership from one modal without leaving the page.'}
                </DialogDescription>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{group?.contact_count ?? 0} member(s)</Badge>
                  {group?.type ? <Badge variant="outline">{group.type}</Badge> : null}
                </div>
              </div>
              {group && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={onAddMembers}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Members
                  </Button>
                  <Button variant="outline" size="sm" onClick={onRemoveMembers}>
                    <UserMinus className="mr-2 h-4 w-4" />
                    Remove Members
                  </Button>
                  <Button variant="destructive" size="sm" onClick={onDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-6 pt-2">
          {selectedContactIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-3">
              <span className="text-sm font-medium">{selectedContactIds.length} selected</span>
              <Button variant="outline" size="sm" onClick={onRemoveMembers}>
                <UserMinus className="mr-2 h-4 w-4" />
                Remove Selected
              </Button>
            </div>
          )}

          <ScrollArea className="h-[420px] rounded-xl border bg-muted/10 p-4">
            {loading ? (
              <div className="flex h-full min-h-52 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading group members
              </div>
            ) : group ? (
              members.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {members.map((member) => (
                    <div key={member.id} className="rounded-xl border bg-background p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedContactIds.includes(member.id)}
                            onCheckedChange={(checked) => onToggleContact(member.id, checked === true)}
                          />
                          <div className="space-y-1">
                            <button className="text-left font-medium hover:underline" onClick={() => onOpenContact(member.id)}>
                              {member.name || member.phone}
                            </button>
                            <div className="text-xs text-muted-foreground">{member.phone}</div>
                            {member.email ? <div className="text-xs text-muted-foreground">{member.email}</div> : null}
                          </div>
                        </div>
                        <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {member.tags?.length ? member.tags.map((tag) => (
                          <Badge key={tag.id} variant="outline" style={{ borderColor: tag.color, color: tag.color }}>
                            {tag.name}
                          </Badge>
                        )) : (
                          <span className="text-xs text-muted-foreground">No tags</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full min-h-52 flex-col items-center justify-center gap-2 text-center">
                  <Users className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">No members yet</p>
                  <p className="max-w-md text-sm text-muted-foreground">
                    This group is ready to use, but it does not have any contacts yet. Add members whenever you are ready.
                  </p>
                </div>
              )
            ) : (
              <div className="flex h-full min-h-52 items-center justify-center text-sm text-muted-foreground">
                Select a group to inspect it.
              </div>
            )}
          </ScrollArea>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onPageChange(meta.page - 1)} disabled={meta.page <= 1}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => onPageChange(meta.page + 1)} disabled={meta.page >= meta.totalPages}>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
