import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import type {
  ApiResponse,
  Contact,
  ContactImportResult,
  Group,
  GroupDetailResult,
  GroupImportResult,
  PaginationMeta,
  Tag,
} from '@/core/types';
import type {
  CreateContactFormData,
  CreateGroupFormData,
  CreateTagFormData,
  UpdateContactFormData,
} from './validations';

interface ListContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  tag_id?: string;
  group_id?: string;
  source?: string;
  enabled?: boolean;
}

interface ListGroupsParams {
  page?: number;
  limit?: number;
  search?: string;
}

interface GroupDetailParams {
  page?: number;
  limit?: number;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

async function downloadCsvSample(url: string, filename: string) {
  const response = await apiClient.get(url, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export function useContacts(params: ListContactsParams = {}) {
  const query = buildQuery({
    page: params.page,
    limit: params.limit,
    search: params.search,
    tag_id: params.tag_id,
    group_id: params.group_id,
    source: params.source,
  });

  return useQuery({
    queryKey: ['contacts', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get(`${ENDPOINTS.CONTACTS.BASE}${query}`);
      return data as ApiResponse<{ contacts: Contact[] }> & { meta: PaginationMeta };
    },
    enabled: params.enabled ?? true,
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: ['contacts', 'detail', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`${ENDPOINTS.CONTACTS.BASE}/${id}`);
      return data.data.contact as Contact;
    },
    enabled: Boolean(id),
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateContactFormData) => {
      const { data } = await apiClient.post(ENDPOINTS.CONTACTS.BASE, body);
      return data.data.contact as Contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useUpdateContact(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateContactFormData) => {
      const { data } = await apiClient.put(`${ENDPOINTS.CONTACTS.BASE}/${id}`, body);
      return data.data.contact as Contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts', 'detail', id] });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${ENDPOINTS.CONTACTS.BASE}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions', 'current'] });
    },
  });
}

export function useBulkDeleteContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await apiClient.post(ENDPOINTS.CONTACTS.BULK_DELETE, { ids });
      return data.data as { deleted_count: number; skipped_count: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions', 'current'] });
    },
  });
}

export function useImportCSV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await apiClient.post(ENDPOINTS.CONTACTS.IMPORT_CSV, formData);
      return data.data as ContactImportResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions', 'current'] });
    },
  });
}

export function useImportGroupsCSV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await apiClient.post(ENDPOINTS.CONTACTS.IMPORT_GROUPS_CSV, formData);
      return data.data as GroupImportResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions', 'current'] });
    },
  });
}

export function downloadContactCsvSample() {
  return downloadCsvSample(ENDPOINTS.CONTACTS.SAMPLE_CONTACT_CSV, 'contacts-sample.csv');
}

export function downloadGroupCsvSample() {
  return downloadCsvSample(ENDPOINTS.CONTACTS.SAMPLE_GROUP_CSV, 'groups-sample.csv');
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await apiClient.get(ENDPOINTS.CONTACTS.TAGS);
      return data.data.tags as Tag[];
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateTagFormData) => {
      const { data } = await apiClient.post(ENDPOINTS.CONTACTS.TAGS, body);
      return data.data.tag as Tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...body }: CreateTagFormData & { id: string }) => {
      const { data } = await apiClient.put(`${ENDPOINTS.CONTACTS.TAGS}/${id}`, body);
      return data.data.tag as Tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${ENDPOINTS.CONTACTS.TAGS}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useAddTagsToContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, tagIds }: { contactId: string; tagIds: string[] }) => {
      const { data } = await apiClient.post(`${ENDPOINTS.CONTACTS.BASE}/${contactId}/tags`, { tag_ids: tagIds });
      return data.data.contact as Contact;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts', 'detail', variables.contactId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useBulkAssignTagsToContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactIds, tagIds }: { contactIds: string[]; tagIds: string[] }) => {
      const { data } = await apiClient.post(ENDPOINTS.CONTACTS.TAGS_BULK_ASSIGN, {
        contact_ids: contactIds,
        tag_ids: tagIds,
      });
      return data.data as { contact_count: number; tag_count: number; added_count: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useBulkRemoveTagsFromContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactIds, tagIds }: { contactIds: string[]; tagIds: string[] }) => {
      const { data } = await apiClient.delete(ENDPOINTS.CONTACTS.TAGS_BULK_ASSIGN, {
        data: {
          contact_ids: contactIds,
          tag_ids: tagIds,
        },
      });
      return data.data as { contact_count: number; tag_count: number; removed_count: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useGroups(params: ListGroupsParams = {}) {
  const query = buildQuery({
    page: params.page,
    limit: params.limit,
    search: params.search,
  });

  return useQuery({
    queryKey: ['groups', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get(`${ENDPOINTS.CONTACTS.GROUPS}${query}`);
      return data as ApiResponse<{ groups: Group[] }> & { meta: PaginationMeta };
    },
  });
}

export function useGroup(id: string | undefined, params: GroupDetailParams = {}) {
  const query = buildQuery({
    page: params.page,
    limit: params.limit,
  });

  return useQuery({
    queryKey: ['groups', 'detail', id, params],
    queryFn: async () => {
      const { data } = await apiClient.get(`${ENDPOINTS.CONTACTS.GROUPS}/${id}${query}`);
      return {
        group: data.data.group as Group,
        members: data.data.members as Contact[],
        meta: data.meta as PaginationMeta,
      } as GroupDetailResult;
    },
    enabled: Boolean(id),
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateGroupFormData) => {
      const { data } = await apiClient.post(ENDPOINTS.CONTACTS.GROUPS, body);
      return data.data.group as Group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<CreateGroupFormData> & { id: string }) => {
      const { data } = await apiClient.put(`${ENDPOINTS.CONTACTS.GROUPS}/${id}`, body);
      return data.data.group as Group;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', variables.id] });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${ENDPOINTS.CONTACTS.GROUPS}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useAddGroupMembers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, contactIds }: { groupId: string; contactIds: string[] }) => {
      const { data } = await apiClient.post(`${ENDPOINTS.CONTACTS.GROUPS}/${groupId}/members`, { contact_ids: contactIds });
      return data.data as { added_count: number; contact_count: number };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useRemoveGroupMembers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, contactIds }: { groupId: string; contactIds: string[] }) => {
      const { data } = await apiClient.delete(`${ENDPOINTS.CONTACTS.GROUPS}/${groupId}/members`, {
        data: { contact_ids: contactIds },
      });
      return data.data as { removed_count: number; contact_count: number };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useBulkAssignContactsToGroups() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupIds, contactIds }: { groupIds: string[]; contactIds: string[] }) => {
      const { data } = await apiClient.post(ENDPOINTS.CONTACTS.GROUPS_BULK_MEMBERSHIPS, {
        group_ids: groupIds,
        contact_ids: contactIds,
      });
      return data.data as { group_count: number; contact_count: number; added_count: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useBulkRemoveContactsFromGroups() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupIds, contactIds }: { groupIds: string[]; contactIds: string[] }) => {
      const { data } = await apiClient.delete(ENDPOINTS.CONTACTS.GROUPS_BULK_MEMBERSHIPS, {
        data: {
          group_ids: groupIds,
          contact_ids: contactIds,
        },
      });
      return data.data as { group_count: number; contact_count: number; removed_count: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}
