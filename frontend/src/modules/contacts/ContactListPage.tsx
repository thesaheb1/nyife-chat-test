import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import {
  FolderPlus,
  MoreHorizontal,
  Plus,
  Tags,
  Trash2,
  Upload,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { TabsContent } from '@/components/ui/tabs';
import { DataTable } from '@/shared/components/DataTable';
import { useDebounce } from '@/core/hooks';
import {
  BulkActionsBar,
  ListingEmptyState,
  ListingPageHeader,
  ListingTableCard,
  ListingTabsShell,
  ListingToolbar,
} from '@/shared/components';
import { useListingState } from '@/shared/hooks/useListingState';
import type { Contact, Group } from '@/core/types';
import {
  downloadContactCsvSample,
  downloadGroupCsvSample,
  useAddGroupMembers,
  useBulkAssignContactsToGroups,
  useBulkAssignTagsToContacts,
  useBulkDeleteContacts,
  useBulkRemoveContactsFromGroups,
  useBulkRemoveTagsFromContacts,
  useContacts,
  useCreateGroup,
  useCreateTag,
  useDeleteContact,
  useDeleteGroup,
  useDeleteTag,
  useGroup,
  useGroups,
  useImportCSV,
  useImportGroupsCSV,
  useRemoveGroupMembers,
  useTags,
  useUpdateGroup,
  useUpdateTag,
} from './useContacts';
import { CreateContactDialog } from './CreateContactDialog';
import {
  BulkGroupDialog,
  BulkTagDialog,
  GroupContactsDialog,
  GroupDetailDialog,
  GroupEditorDialog,
  TagManagerDialog,
} from './ContactsDialogs';
import { CsvImportDialog } from './CsvImportDialog';

type TabKey = 'contacts' | 'groups';
type BulkTagMode = 'assign' | 'remove';
type BulkGroupMode = 'assign' | 'remove';
type GroupMemberMode = 'assign' | 'remove';
type GroupEditorMode = 'create' | 'edit';

function setQueryState(
  searchParams: URLSearchParams,
  setSearchParams: (next: URLSearchParams, options?: { replace?: boolean }) => void,
  updates: Record<string, string | null>,
) {
  const next = new URLSearchParams(searchParams);

  Object.entries(updates).forEach(([key, value]) => {
    if (!value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  });

  setSearchParams(next, { replace: true });
}

export function ContactListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') === 'groups' ? 'groups' : 'contacts') as TabKey;
  const contactListing = useListingState({
    initialFilters: {
      tag_id: '',
      group_id: '',
    },
    syncToUrl: true,
    namespace: 'contacts',
  });
  const groupListing = useListingState({
    initialFilters: {
      type: '',
    },
    syncToUrl: true,
    namespace: 'groups',
  });
  const [groupEditorSearch, setGroupEditorSearch] = useState('');
  const [groupMemberSearch, setGroupMemberSearch] = useState('');
  const [memberPage, setMemberPage] = useState(1);
  const [groupEditorContactPage, setGroupEditorContactPage] = useState(1);
  const [groupMemberContactPage, setGroupMemberContactPage] = useState(1);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Group[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupDetailOpen, setGroupDetailOpen] = useState(false);
  const [bulkDeleteContactsOpen, setBulkDeleteContactsOpen] = useState(false);
  const [bulkDeleteGroupsOpen, setBulkDeleteGroupsOpen] = useState(false);
  const [bulkTagMode, setBulkTagMode] = useState<BulkTagMode | null>(null);
  const [bulkGroupMode, setBulkGroupMode] = useState<BulkGroupMode | null>(null);
  const [groupMemberMode, setGroupMemberMode] = useState<GroupMemberMode | null>(null);
  const [groupEditorMode, setGroupEditorMode] = useState<GroupEditorMode>('create');
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupFormName, setGroupFormName] = useState('');
  const [groupFormDescription, setGroupFormDescription] = useState('');
  const [groupFormContactIds, setGroupFormContactIds] = useState<string[]>([]);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagFormName, setTagFormName] = useState('');
  const [tagFormColor, setTagFormColor] = useState('#3B82F6');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedDialogGroupIds, setSelectedDialogGroupIds] = useState<string[]>([]);
  const [selectedDialogContactIds, setSelectedDialogContactIds] = useState<string[]>([]);

  const debouncedGroupEditorSearch = useDebounce(groupEditorSearch, 300);
  const debouncedGroupMemberSearch = useDebounce(groupMemberSearch, 300);

  const contactsQuery = useContacts({
    page: contactListing.page,
    limit: 20,
    search: contactListing.debouncedSearch || undefined,
    tag_id: contactListing.filters.tag_id || undefined,
    group_id: contactListing.filters.group_id || undefined,
    date_from: contactListing.dateRange.from,
    date_to: contactListing.dateRange.to,
  });
  const groupsQuery = useGroups({
    page: groupListing.page,
    limit: 20,
    search: groupListing.debouncedSearch || undefined,
    type: (groupListing.filters.type || undefined) as Group['type'] | undefined,
    date_from: groupListing.dateRange.from,
    date_to: groupListing.dateRange.to,
  });
  const groupEditorContactsQuery = useContacts({
    page: groupEditorContactPage,
    limit: 12,
    search: debouncedGroupEditorSearch || undefined,
    enabled: groupEditorOpen && groupEditorMode === 'create',
  });
  const groupMemberContactsQuery = useContacts({
    page: groupMemberContactPage,
    limit: 12,
    search: debouncedGroupMemberSearch || undefined,
    enabled: Boolean(groupMemberMode),
  });
  const tagsQuery = useTags();
  const groupDetailQuery = useGroup(activeGroupId ?? undefined, {
    page: memberPage,
    limit: 12,
  });

  const deleteContact = useDeleteContact();
  const bulkDeleteContacts = useBulkDeleteContacts();
  const bulkAssignGroups = useBulkAssignContactsToGroups();
  const bulkRemoveGroups = useBulkRemoveContactsFromGroups();
  const bulkAssignTags = useBulkAssignTagsToContacts();
  const bulkRemoveTags = useBulkRemoveTagsFromContacts();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const addGroupMembers = useAddGroupMembers();
  const removeGroupMembers = useRemoveGroupMembers();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const importContacts = useImportCSV();
  const importGroups = useImportGroupsCSV();

  const contacts = contactsQuery.data?.data.contacts ?? [];
  const contactsMeta = contactsQuery.data?.meta;
  const groups = groupsQuery.data?.data.groups ?? [];
  const groupsMeta = groupsQuery.data?.meta;
  const activeGroup = groupDetailQuery.data?.group ?? groups.find((group) => group.id === activeGroupId) ?? null;
  const activeMembers = groupDetailQuery.data?.members ?? [];
  const activeMembersMeta = groupDetailQuery.data?.meta;
  const tags = tagsQuery.data?.data.tags ?? [];
  const groupEditorContacts = groupEditorContactsQuery.data?.data.contacts ?? [];
  const groupEditorContactsMeta = groupEditorContactsQuery.data?.meta;
  const groupMemberContacts = groupMemberContactsQuery.data?.data.contacts ?? [];
  const groupMemberContactsMeta = groupMemberContactsQuery.data?.meta;
  const editingTag = tags.find((tag) => tag.id === editingTagId) ?? null;
  const tagsDialogVisible = tagsDialogOpen || searchParams.get('panel') === 'tags';
  const csvDialogVisible = csvDialogOpen || searchParams.get('panel') === 'import';

  const summary = {
    contacts: contactsMeta?.total ?? 0,
    groups: groupsMeta?.total ?? groups.length,
  };

  const resetTagEditor = () => {
    setEditingTagId(null);
    setTagFormName('');
    setTagFormColor('#3B82F6');
  };

  const resetGroupEditor = () => {
    setEditingGroup(null);
    setGroupFormName('');
    setGroupFormDescription('');
    setGroupFormContactIds([]);
  };

  const openImportDialog = () => {
    setCsvDialogOpen(true);
    setQueryState(searchParams, setSearchParams, { panel: 'import' });
  };

  const openTagsDialog = () => {
    setTagsDialogOpen(true);
    setQueryState(searchParams, setSearchParams, { panel: 'tags' });
  };

  const closeManagedDialog = (panel: 'tags' | 'import') => {
    if (searchParams.get('panel') === panel) {
      setQueryState(searchParams, setSearchParams, { panel: null });
    }
  };

  const openCreateGroupDialog = () => {
    resetGroupEditor();
    setGroupEditorMode('create');
    setGroupEditorSearch('');
    setGroupEditorContactPage(1);
    setGroupEditorOpen(true);
  };

  const openEditGroupDialog = (group: Group) => {
    setEditingGroup(group);
    setGroupFormName(group.name);
    setGroupFormDescription(group.description || '');
    setGroupFormContactIds([]);
    setGroupEditorMode('edit');
    setGroupEditorSearch('');
    setGroupEditorContactPage(1);
    setGroupEditorOpen(true);
  };

  const openGroupDetail = (group: Group) => {
    setActiveGroupId(group.id);
    setMemberPage(1);
    setSelectedMemberIds([]);
    setGroupDetailOpen(true);
  };

  const openSingleContactTagDialog = (contact: Contact, mode: BulkTagMode) => {
    setSelectedContacts([contact]);
    setSelectedTagIds([]);
    setBulkTagMode(mode);
  };

  const openSingleContactGroupDialog = (contact: Contact, mode: BulkGroupMode) => {
    setSelectedContacts([contact]);
    setSelectedDialogGroupIds([]);
    setBulkGroupMode(mode);
  };

  const openSingleGroupMemberDialog = (group: Group, mode: GroupMemberMode) => {
    setSelectedGroups([group]);
    setSelectedDialogContactIds([]);
    setGroupMemberSearch('');
    setGroupMemberContactPage(1);
    setGroupMemberMode(mode);
  };

  const confirmSingleContactDelete = (contact: Contact) => {
    setSelectedContacts([contact]);
    setBulkDeleteContactsOpen(true);
  };

  const confirmSingleGroupDelete = (group: Group) => {
    setSelectedGroups([group]);
    setBulkDeleteGroupsOpen(true);
  };

  const handleDeleteSelectedContacts = async () => {
    try {
      if (selectedContacts.length === 1) {
        await deleteContact.mutateAsync(selectedContacts[0].id);
        toast.success('Contact deleted');
      } else {
        const result = await bulkDeleteContacts.mutateAsync(selectedContacts.map((contact) => contact.id));
        toast.success(`${result.deleted_count} contact(s) deleted`);
      }
      setSelectedContacts([]);
      setBulkDeleteContactsOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete the selected contacts.'));
    }
  };

  const handleDeleteSelectedGroups = async () => {
    try {
      await Promise.all(selectedGroups.map((group) => deleteGroup.mutateAsync(group.id)));
      toast.success(`${selectedGroups.length} group(s) deleted`);
      if (activeGroupId && selectedGroups.some((group) => group.id === activeGroupId)) {
        setGroupDetailOpen(false);
        setActiveGroupId(null);
        setSelectedMemberIds([]);
      }
      setSelectedGroups([]);
      setBulkDeleteGroupsOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete the selected groups.'));
    }
  };

  const handleSubmitTag = async () => {
    if (!tagFormName.trim()) {
      toast.error('Tag name is required');
      return;
    }

    try {
      if (editingTagId) {
        await updateTag.mutateAsync({ id: editingTagId, name: tagFormName.trim(), color: tagFormColor });
        toast.success('Tag updated');
      } else {
        await createTag.mutateAsync({ name: tagFormName.trim(), color: tagFormColor });
        toast.success('Tag created');
      }
      resetTagEditor();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save the tag.'));
    }
  };

  const handleSubmitGroup = async () => {
    if (!groupFormName.trim()) {
      toast.error('Group name is required');
      return;
    }

    try {
      if (groupEditorMode === 'create') {
        const group = await createGroup.mutateAsync({
          name: groupFormName.trim(),
          description: groupFormDescription.trim() || undefined,
          contact_ids: groupFormContactIds.length ? groupFormContactIds : undefined,
        });
        toast.success(groupFormContactIds.length ? 'Group created with members' : 'Group created');
        setActiveGroupId(group.id);
      } else if (editingGroup) {
        await updateGroup.mutateAsync({
          id: editingGroup.id,
          name: groupFormName.trim(),
          description: groupFormDescription.trim() || undefined,
        });
        toast.success('Group updated');
      }
      setGroupEditorOpen(false);
      resetGroupEditor();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save the group.'));
    }
  };

  const handleBulkTagAction = async () => {
    if (!bulkTagMode || !selectedTagIds.length) {
      toast.error('Select at least one tag');
      return;
    }

    try {
      if (bulkTagMode === 'assign') {
        const result = await bulkAssignTags.mutateAsync({
          contactIds: selectedContacts.map((contact) => contact.id),
          tagIds: selectedTagIds,
        });
        toast.success(`${result.added_count} tag assignment(s) added`);
      } else {
        const result = await bulkRemoveTags.mutateAsync({
          contactIds: selectedContacts.map((contact) => contact.id),
          tagIds: selectedTagIds,
        });
        toast.success(`${result.removed_count} tag assignment(s) removed`);
      }
      setSelectedTagIds([]);
      setBulkTagMode(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update contact tags.'));
    }
  };

  const handleBulkGroupAction = async () => {
    if (!bulkGroupMode || !selectedDialogGroupIds.length) {
      toast.error('Select at least one group');
      return;
    }

    try {
      if (bulkGroupMode === 'assign') {
        const result = await bulkAssignGroups.mutateAsync({
          groupIds: selectedDialogGroupIds,
          contactIds: selectedContacts.map((contact) => contact.id),
        });
        toast.success(`${result.added_count} membership(s) added`);
      } else {
        const result = await bulkRemoveGroups.mutateAsync({
          groupIds: selectedDialogGroupIds,
          contactIds: selectedContacts.map((contact) => contact.id),
        });
        toast.success(`${result.removed_count} membership(s) removed`);
      }
      setSelectedDialogGroupIds([]);
      setBulkGroupMode(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update group memberships.'));
    }
  };

  const handleGroupMembersAction = async () => {
    const targetGroupIds = selectedGroups.length
      ? selectedGroups.map((group) => group.id)
      : activeGroupId
        ? [activeGroupId]
        : [];

    if (!groupMemberMode || !targetGroupIds.length || !selectedDialogContactIds.length) {
      toast.error('Select at least one group and one contact');
      return;
    }

    try {
      if (groupMemberMode === 'assign') {
        if (targetGroupIds.length === 1) {
          const result = await addGroupMembers.mutateAsync({
            groupId: targetGroupIds[0],
            contactIds: selectedDialogContactIds,
          });
          toast.success(`${result.added_count} member(s) added`);
        } else {
          const result = await bulkAssignGroups.mutateAsync({
            groupIds: targetGroupIds,
            contactIds: selectedDialogContactIds,
          });
          toast.success(`${result.added_count} membership(s) added`);
        }
      } else if (targetGroupIds.length === 1) {
        const result = await removeGroupMembers.mutateAsync({
          groupId: targetGroupIds[0],
          contactIds: selectedDialogContactIds,
        });
        toast.success(`${result.removed_count} member(s) removed`);
      } else {
        const result = await bulkRemoveGroups.mutateAsync({
          groupIds: targetGroupIds,
          contactIds: selectedDialogContactIds,
        });
        toast.success(`${result.removed_count} membership(s) removed`);
      }

      setSelectedDialogContactIds([]);
      setGroupMemberMode(null);
      setSelectedMemberIds([]);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update group members.'));
    }
  };

  const handleRemoveSelectedMembers = async () => {
    if (!activeGroupId || !selectedMemberIds.length) {
      return;
    }

    try {
      const result = await removeGroupMembers.mutateAsync({
        groupId: activeGroupId,
        contactIds: selectedMemberIds,
      });
      toast.success(`${result.removed_count} member(s) removed`);
      setSelectedMemberIds([]);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to remove the selected members.'));
    }
  };

  const contactColumns = useMemo<ColumnDef<Contact, unknown>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Contact',
      cell: ({ row }) => (
        <button
          className="text-left hover:underline"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/contacts/${row.original.id}`);
          }}
        >
          <div className="font-medium">{row.original.name || row.original.whatsapp_name || row.original.phone}</div>
          <div className="text-xs text-muted-foreground">{row.original.phone}</div>
        </button>
      ),
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
          {row.original.tags?.length ? row.original.tags.map((tag) => (
            <Badge key={tag.id} variant="outline" style={{ borderColor: tag.color, color: tag.color }} className="text-xs">
              {tag.name}
            </Badge>
          )) : <span className="text-xs text-muted-foreground">No tags</span>}
        </div>
      ),
    },
    {
      id: 'groups',
      header: 'Groups',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.groups?.length ? row.original.groups.map((group) => (
            <button
              key={group.id}
              onClick={(event) => {
                event.stopPropagation();
                setQueryState(searchParams, setSearchParams, { tab: 'groups' });
                openGroupDetail(group);
              }}
            >
              <Badge variant="secondary" className="text-xs">
                {group.name}
              </Badge>
            </button>
          )) : <span className="text-xs text-muted-foreground">No groups</span>}
        </div>
      ),
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ getValue }) => (
        <Badge variant="outline" className="text-xs">
          {String(getValue() || '').replace('_', ' ')}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem onClick={() => navigate(`/contacts/${row.original.id}`)}>
            View contact
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openSingleContactTagDialog(row.original, 'assign')}>
            Add tags
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openSingleContactTagDialog(row.original, 'remove')}>
            Remove tags
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openSingleContactGroupDialog(row.original, 'assign')}>
            Assign groups
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openSingleContactGroupDialog(row.original, 'remove')}>
            Remove groups
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => confirmSingleContactDelete(row.original)}>
            Delete contact
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    },
  ], [navigate, searchParams, setSearchParams]);

  const groupColumns = useMemo<ColumnDef<Group, unknown>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Group',
      cell: ({ row }) => (
        <button
          className="text-left hover:underline"
          onClick={(event) => {
            event.stopPropagation();
            openGroupDetail(row.original);
          }}
        >
          <div className="font-medium">{row.original.name}</div>
          <div className="line-clamp-1 text-xs text-muted-foreground">{row.original.description || 'No description'}</div>
        </button>
      ),
    },
    {
      accessorKey: 'contact_count',
      header: 'Members',
      cell: ({ getValue }) => <Badge variant="secondary">{getValue() as number}</Badge>,
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ getValue }) => <Badge variant="outline" className="text-xs">{String(getValue())}</Badge>,
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem onClick={() => openGroupDetail(row.original)}>
            View members
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openEditGroupDialog(row.original)}>
            Edit group
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openSingleGroupMemberDialog(row.original, 'assign')}>
            Add contacts
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openSingleGroupMemberDialog(row.original, 'remove')}>
            Remove contacts
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => confirmSingleGroupDelete(row.original)}>
            Delete group
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Contacts and Groups"
        description={activeTab === 'contacts' ? `${summary.contacts} contacts` : `${summary.groups} groups`}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={openTagsDialog}>
              <Tags className="mr-2 h-4 w-4" />
              Manage Tags
            </Button>
            <Button variant="outline" size="sm" onClick={openImportDialog}>
              <Upload className="mr-2 h-4 w-4" />
              CSV Import
            </Button>
          </>
        )}
      />

      <ListingTabsShell
        value={activeTab}
        onValueChange={(value) => setQueryState(searchParams, setSearchParams, { tab: value })}
        tabs={[
          { value: 'contacts', label: 'Contacts' },
          { value: 'groups', label: 'Groups' },
        ]}
      >

        <TabsContent value="contacts" className="space-y-4">

          <ListingTableCard>
            <ListingToolbar
              searchValue={contactListing.search}
              onSearchChange={contactListing.setSearch}
              searchPlaceholder="Search name, phone, or email"
              filters={[
                {
                  id: 'tag_id',
                  value: contactListing.filters.tag_id,
                  placeholder: 'Tag',
                  onChange: (value) => contactListing.setFilter('tag_id', value),
                  allLabel: 'All tags',
                  options: tags.map((tag) => ({ value: tag.id, label: tag.name })),
                },
                {
                  id: 'group_id',
                  value: contactListing.filters.group_id,
                  placeholder: 'Group',
                  onChange: (value) => contactListing.setFilter('group_id', value),
                  allLabel: 'All groups',
                  options: groups.map((group) => ({ value: group.id, label: group.name })),
                },
              ]}
              dateRange={contactListing.dateRange}
              onDateRangeChange={contactListing.setDateRange}
              dateRangePlaceholder="Created date range"
              hasActiveFilters={contactListing.hasActiveFilters}
              onReset={contactListing.resetAll}
              actions={(
                <Button size="sm" onClick={() => setCreateContactOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contact
                </Button>
              )}
            />

            {selectedContacts.length > 0 && (
              <BulkActionsBar selectedCount={selectedContacts.length}>
                <Button variant="outline" size="sm" onClick={() => setBulkTagMode('assign')}>
                  <Tags className="mr-2 h-4 w-4" />
                  Add Tags
                </Button>
                <Button variant="outline" size="sm" onClick={() => setBulkTagMode('remove')}>
                  <Tags className="mr-2 h-4 w-4" />
                  Remove Tags
                </Button>
                <Button variant="outline" size="sm" onClick={() => setBulkGroupMode('assign')}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Assign Groups
                </Button>
                <Button variant="outline" size="sm" onClick={() => setBulkGroupMode('remove')}>
                  <UserMinus className="mr-2 h-4 w-4" />
                  Remove Groups
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setBulkDeleteContactsOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </BulkActionsBar>
            )}

            <DataTable
              columns={contactColumns}
              data={contacts}
              isLoading={contactsQuery.isLoading}
              page={contactsMeta?.page ?? 1}
              totalPages={contactsMeta?.totalPages ?? 1}
              total={contactsMeta?.total}
              onPageChange={contactListing.setPage}
              enableSelection
              onSelectionChange={setSelectedContacts}
              onRowClick={(contact) => navigate(`/contacts/${contact.id}`)}
              emptyMessage={(
                <ListingEmptyState
                  title="No contacts found"
                  description="Add a contact or import a CSV to get started."
                />
              )}
            />
          </ListingTableCard>
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">

          <ListingTableCard>
            <ListingToolbar
              searchValue={groupListing.search}
              onSearchChange={groupListing.setSearch}
              searchPlaceholder="Search groups"
              filters={[
                {
                  id: 'type',
                  value: groupListing.filters.type,
                  placeholder: 'Type',
                  onChange: (value) => groupListing.setFilter('type', value),
                  allLabel: 'All types',
                  options: [
                    { value: 'static', label: 'Static' },
                    { value: 'dynamic', label: 'Dynamic' },
                  ],
                },
              ]}
              dateRange={groupListing.dateRange}
              onDateRangeChange={groupListing.setDateRange}
              dateRangePlaceholder="Created date range"
              hasActiveFilters={groupListing.hasActiveFilters}
              onReset={groupListing.resetAll}
              actions={(
                <Button size="sm" onClick={openCreateGroupDialog}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  New Group
                </Button>
              )}
            />

            {selectedGroups.length > 0 && (
              <BulkActionsBar selectedCount={selectedGroups.length}>
                <Button variant="outline" size="sm" onClick={() => {
                  setSelectedDialogContactIds([]);
                  setGroupMemberSearch('');
                  setGroupMemberContactPage(1);
                  setGroupMemberMode('assign');
                }}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Contacts
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  setSelectedDialogContactIds([]);
                  setGroupMemberSearch('');
                  setGroupMemberContactPage(1);
                  setGroupMemberMode('remove');
                }}>
                  <UserMinus className="mr-2 h-4 w-4" />
                  Remove Contacts
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setBulkDeleteGroupsOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </BulkActionsBar>
            )}
            <DataTable
              columns={groupColumns}
              data={groups}
              isLoading={groupsQuery.isLoading}
              page={groupsMeta?.page ?? 1}
              totalPages={groupsMeta?.totalPages ?? 1}
              total={groupsMeta?.total}
              onPageChange={groupListing.setPage}
              enableSelection
              onSelectionChange={setSelectedGroups}
              onRowClick={openGroupDetail}
              emptyMessage={(
                <ListingEmptyState
                  title="No groups found"
                  description="Create a group now and add members later if needed."
                />
              )}
            />
          </ListingTableCard>
        </TabsContent>
      </ListingTabsShell>

      <CreateContactDialog open={createContactOpen} onOpenChange={setCreateContactOpen} />

      <TagManagerDialog
        open={tagsDialogVisible}
        tags={tags}
        editingTagId={editingTagId}
        tagFormName={tagFormName}
        tagFormColor={tagFormColor}
        isSaving={createTag.isPending || updateTag.isPending}
        isDeleting={deleteTag.isPending}
        onOpenChange={(open) => {
          setTagsDialogOpen(open);
          if (!open) {
            closeManagedDialog('tags');
          }
        }}
        onEditTag={(tag) => {
          setEditingTagId(tag.id);
          setTagFormName(tag.name);
          setTagFormColor(tag.color);
        }}
        onReset={resetTagEditor}
        onTagFormNameChange={setTagFormName}
        onTagFormColorChange={setTagFormColor}
        onSubmit={handleSubmitTag}
        onDelete={async (tagId) => {
          try {
            await deleteTag.mutateAsync(tagId);
            toast.success('Tag deleted');
            if (editingTag?.id === tagId) {
              resetTagEditor();
            }
          } catch (error) {
            toast.error(getApiErrorMessage(error, 'Failed to delete the tag.'));
          }
        }}
      />

      <CsvImportDialog
        open={csvDialogVisible}
        contactsResult={importContacts.data}
        groupsResult={importGroups.data}
        contactsLoading={importContacts.isPending}
        groupsLoading={importGroups.isPending}
        onOpenChange={(open) => {
          setCsvDialogOpen(open);
          if (!open) {
            closeManagedDialog('import');
          }
        }}
        onDownloadContactSample={downloadContactCsvSample}
        onDownloadGroupSample={downloadGroupCsvSample}
        onImportContacts={importContacts.mutateAsync}
        onImportGroups={importGroups.mutateAsync}
      />

      <BulkTagDialog
        open={Boolean(bulkTagMode)}
        mode={bulkTagMode || 'assign'}
        selectedCount={selectedContacts.length}
        tags={tags}
        selectedTagIds={selectedTagIds}
        loading={bulkAssignTags.isPending || bulkRemoveTags.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setBulkTagMode(null);
            setSelectedTagIds([]);
          }
        }}
        onToggleTag={(tagId, checked) => {
          setSelectedTagIds((current) => checked ? [...current, tagId] : current.filter((id) => id !== tagId));
        }}
        onSubmit={handleBulkTagAction}
      />

      <BulkGroupDialog
        open={Boolean(bulkGroupMode)}
        mode={bulkGroupMode || 'assign'}
        selectedCount={selectedContacts.length}
        groups={groups}
        selectedGroupIds={selectedDialogGroupIds}
        loading={bulkAssignGroups.isPending || bulkRemoveGroups.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setBulkGroupMode(null);
            setSelectedDialogGroupIds([]);
          }
        }}
        onToggleGroup={(groupId, checked) => {
          setSelectedDialogGroupIds((current) => checked ? [...current, groupId] : current.filter((id) => id !== groupId));
        }}
        onSubmit={handleBulkGroupAction}
      />

      <GroupEditorDialog
        open={groupEditorOpen}
        mode={groupEditorMode}
        contacts={groupEditorContacts}
        contactsMeta={groupEditorContactsMeta}
        contactsPage={groupEditorContactPage}
        contactsLoading={groupEditorContactsQuery.isLoading}
        saving={createGroup.isPending || updateGroup.isPending}
        selectedContactIds={groupFormContactIds}
        name={groupFormName}
        description={groupFormDescription}
        contactSearch={groupEditorSearch}
        onOpenChange={(open) => {
          setGroupEditorOpen(open);
          if (!open) {
            resetGroupEditor();
            setGroupEditorSearch('');
            setGroupEditorContactPage(1);
          }
        }}
        onNameChange={setGroupFormName}
        onDescriptionChange={setGroupFormDescription}
        onContactSearchChange={(value) => {
          setGroupEditorSearch(value);
          setGroupEditorContactPage(1);
        }}
        onContactsPageChange={setGroupEditorContactPage}
        onToggleContact={(contactId, checked) => {
          setGroupFormContactIds((current) => checked ? [...current, contactId] : current.filter((id) => id !== contactId));
        }}
        onSubmit={handleSubmitGroup}
      />

      <GroupContactsDialog
        open={Boolean(groupMemberMode)}
        mode={groupMemberMode || 'assign'}
        groups={selectedGroups.length ? selectedGroups : activeGroup ? [activeGroup] : []}
        contacts={groupMemberContacts}
        contactsMeta={groupMemberContactsMeta}
        contactsPage={groupMemberContactPage}
        selectedContactIds={selectedDialogContactIds}
        contactSearch={groupMemberSearch}
        contactsLoading={groupMemberContactsQuery.isLoading}
        saving={addGroupMembers.isPending || removeGroupMembers.isPending || bulkAssignGroups.isPending || bulkRemoveGroups.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setGroupMemberMode(null);
            setSelectedDialogContactIds([]);
            setGroupMemberSearch('');
            setGroupMemberContactPage(1);
          }
        }}
        onContactSearchChange={(value) => {
          setGroupMemberSearch(value);
          setGroupMemberContactPage(1);
        }}
        onContactsPageChange={setGroupMemberContactPage}
        onToggleContact={(contactId, checked) => {
          setSelectedDialogContactIds((current) => checked ? [...current, contactId] : current.filter((id) => id !== contactId));
        }}
        onSubmit={handleGroupMembersAction}
      />

      <GroupDetailDialog
        open={groupDetailOpen}
        group={activeGroup}
        members={activeMembers}
        meta={activeMembersMeta}
        loading={groupDetailQuery.isLoading}
        selectedContactIds={selectedMemberIds}
        onOpenChange={(open) => {
          setGroupDetailOpen(open);
          if (!open) {
            setSelectedMemberIds([]);
          }
        }}
        onPageChange={setMemberPage}
        onToggleContact={(contactId, checked) => {
          setSelectedMemberIds((current) => checked ? [...current, contactId] : current.filter((id) => id !== contactId));
        }}
        onEdit={() => {
          if (activeGroup) {
            openEditGroupDialog(activeGroup);
          }
        }}
        onAddMembers={() => {
          if (activeGroup) {
            openSingleGroupMemberDialog(activeGroup, 'assign');
          }
        }}
        onRemoveMembers={() => {
          if (selectedMemberIds.length > 0) {
            void handleRemoveSelectedMembers();
            return;
          }
          if (activeGroup) {
            openSingleGroupMemberDialog(activeGroup, 'remove');
          }
        }}
        onDelete={() => {
          if (activeGroup) {
            confirmSingleGroupDelete(activeGroup);
          }
        }}
        onOpenContact={(contactId) => navigate(`/contacts/${contactId}`)}
      />

      <AlertDialog open={bulkDeleteContactsOpen} onOpenChange={setBulkDeleteContactsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedContacts.length} contact(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected contacts permanently and clears their group and tag memberships.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelectedContacts} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteGroupsOpen} onOpenChange={setBulkDeleteGroupsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedGroups.length} group(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Contacts remain intact, but the selected campaign audiences will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelectedGroups} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowActionsMenu({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
