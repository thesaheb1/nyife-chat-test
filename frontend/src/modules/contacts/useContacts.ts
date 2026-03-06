import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import type { Contact, Tag, Group, ApiResponse, PaginationMeta } from '@/core/types';
import type { CreateContactFormData, UpdateContactFormData, CreateTagFormData, CreateGroupFormData } from './validations';

// ── Contacts ──

interface ListContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  tag_id?: string;
  group_id?: string;
  source?: string;
}

export function useContacts(params: ListContactsParams = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.search) sp.set('search', params.search);
  if (params.tag_id) sp.set('tag_id', params.tag_id);
  if (params.group_id) sp.set('group_id', params.group_id);
  if (params.source) sp.set('source', params.source);
  const query = sp.toString();

  return useQuery({
    queryKey: ['contacts', params],
    queryFn: async () => {
      const { data } = await apiClient.get(`${ENDPOINTS.CONTACTS.BASE}${query ? `?${query}` : ''}`);
      return data as ApiResponse<{ contacts: Contact[] }> & { meta: PaginationMeta };
    },
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: ['contact', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`${ENDPOINTS.CONTACTS.BASE}/${id}`);
      return data.data.contact as Contact;
    },
    enabled: !!id,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateContactFormData) => {
      const { data } = await apiClient.post(ENDPOINTS.CONTACTS.BASE, body);
      return data.data.contact as Contact;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useUpdateContact(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateContactFormData) => {
      const { data } = await apiClient.put(`${ENDPOINTS.CONTACTS.BASE}/${id}`, body);
      return data.data.contact as Contact;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['contact', id] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${ENDPOINTS.CONTACTS.BASE}/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useBulkDeleteContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await apiClient.post(ENDPOINTS.CONTACTS.BULK_DELETE, { ids });
      return data.data as { deleted_count: number; skipped_count: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useImportCSV() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await apiClient.post(ENDPOINTS.CONTACTS.IMPORT_CSV, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data as {
        total: number;
        created: number;
        updated: number;
        skipped: number;
        errors: Array<{ row: number | null; phone: string; reason: string }>;
      };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

// ── Tags ──

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await apiClient.get(ENDPOINTS.CONTACTS.TAGS);
      return data.data.tags as (Tag & { contact_count: number })[];
    },
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateTagFormData) => {
      const { data } = await apiClient.post(ENDPOINTS.CONTACTS.TAGS, body);
      return data.data.tag as Tag;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: CreateTagFormData & { id: string }) => {
      const { data } = await apiClient.put(`${ENDPOINTS.CONTACTS.TAGS}/${id}`, body);
      return data.data.tag as Tag;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${ENDPOINTS.CONTACTS.TAGS}/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useAddTagsToContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, tagIds }: { contactId: string; tagIds: string[] }) => {
      const { data } = await apiClient.post(`${ENDPOINTS.CONTACTS.BASE}/${contactId}/tags`, { tag_ids: tagIds });
      return data.data.contact as Contact;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['contact', vars.contactId] });
    },
  });
}

// ── Groups ──

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await apiClient.get(ENDPOINTS.CONTACTS.GROUPS);
      return data.data.groups as Group[];
    },
  });
}

export function useGroup(id: string | undefined) {
  return useQuery({
    queryKey: ['group', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`${ENDPOINTS.CONTACTS.GROUPS}/${id}`);
      return data.data as { group: Group; members: Contact[] };
    },
    enabled: !!id,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateGroupFormData) => {
      const { data } = await apiClient.post(ENDPOINTS.CONTACTS.GROUPS, body);
      return data.data.group as Group;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<CreateGroupFormData> & { id: string }) => {
      const { data } = await apiClient.put(`${ENDPOINTS.CONTACTS.GROUPS}/${id}`, body);
      return data.data.group as Group;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${ENDPOINTS.CONTACTS.GROUPS}/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useAddGroupMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, contactIds }: { groupId: string; contactIds: string[] }) => {
      const { data } = await apiClient.post(`${ENDPOINTS.CONTACTS.GROUPS}/${groupId}/members`, { contact_ids: contactIds });
      return data.data as { added_count: number; contact_count: number };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['group', vars.groupId] });
    },
  });
}

export function useRemoveGroupMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, contactIds }: { groupId: string; contactIds: string[] }) => {
      const { data } = await apiClient.delete(`${ENDPOINTS.CONTACTS.GROUPS}/${groupId}/members`, { data: { contact_ids: contactIds } });
      return data.data as { removed_count: number; contact_count: number };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['group', vars.groupId] });
    },
  });
}
