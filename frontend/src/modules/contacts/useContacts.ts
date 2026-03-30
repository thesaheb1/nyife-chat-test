import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { organizationQueryKey } from '@/core/queryKeys';
import type { RootState } from '@/core/store';
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
import { useOrganizationContext } from '@/modules/organizations/useOrganizationContext';
import { buildListQuery } from '@/shared/utils/listing';

interface ListContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  ids?: string;
  tag_id?: string;
  tag_ids?: string;
  group_id?: string;
  source?: string;
  date_from?: string;
  date_to?: string;
  enabled?: boolean;
}

interface ListGroupsParams {
  page?: number;
  limit?: number;
  search?: string;
  ids?: string;
  type?: Group['type'];
  date_from?: string;
  date_to?: string;
}

interface ListTagsParams {
  page?: number;
  limit?: number;
  search?: string;
  ids?: string;
}

interface GroupDetailParams {
  page?: number;
  limit?: number;
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
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  const query = buildListQuery({
    page: params.page,
    limit: params.limit,
    search: params.search,
    ids: params.ids,
    tag_id: params.tag_id,
    tag_ids: params.tag_ids,
    group_id: params.group_id,
    source: params.source,
    date_from: params.date_from,
    date_to: params.date_to,
  });

  return useQuery({
    queryKey: organizationQueryKey(['contacts', 'list', params] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get(`${ENDPOINTS.CONTACTS.BASE}${query}`);
      return data as ApiResponse<{ contacts: Contact[] }> & { meta: PaginationMeta };
    },
    enabled: (params.enabled ?? true) && Boolean(userId && activeOrganization?.id),
  });
}

export function useContact(id: string | undefined) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  return useQuery({
    queryKey: organizationQueryKey(['contacts', 'detail', id] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get(`${ENDPOINTS.CONTACTS.BASE}/${id}`);
      return data.data.contact as Contact;
    },
    enabled: Boolean(id && userId && activeOrganization?.id),
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
      queryClient.invalidateQueries({ queryKey: ['subscription', 'current'] });
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
      queryClient.invalidateQueries({ queryKey: ['subscription', 'current'] });
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
      queryClient.invalidateQueries({ queryKey: ['subscription', 'current'] });
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
      queryClient.invalidateQueries({ queryKey: ['subscription', 'current'] });
    },
  });
}

export function downloadContactCsvSample() {
  return downloadCsvSample(ENDPOINTS.CONTACTS.SAMPLE_CONTACT_CSV, 'contacts-sample.csv');
}

export function downloadGroupCsvSample() {
  return downloadCsvSample(ENDPOINTS.CONTACTS.SAMPLE_GROUP_CSV, 'groups-sample.csv');
}

export function useTags(params: ListTagsParams = {}) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  const query = buildListQuery({
    page: params.page,
    limit: params.limit,
    search: params.search,
    ids: params.ids,
  });

  return useQuery({
    queryKey: organizationQueryKey(['tags', params] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get(`${ENDPOINTS.CONTACTS.TAGS}${query}`);
      return data as ApiResponse<{ tags: Tag[] }> & { meta?: PaginationMeta };
    },
    enabled: Boolean(userId && activeOrganization?.id),
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
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  const query = buildListQuery({
    page: params.page,
    limit: params.limit,
    search: params.search,
    ids: params.ids,
    type: params.type,
    date_from: params.date_from,
    date_to: params.date_to,
  });

  return useQuery({
    queryKey: organizationQueryKey(['groups', 'list', params] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get(`${ENDPOINTS.CONTACTS.GROUPS}${query}`);
      return data as ApiResponse<{ groups: Group[] }> & { meta: PaginationMeta };
    },
    enabled: Boolean(userId && activeOrganization?.id),
  });
}

export function useGroup(id: string | undefined, params: GroupDetailParams = {}) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  const query = buildListQuery({
    page: params.page,
    limit: params.limit,
  });

  return useQuery({
    queryKey: organizationQueryKey(['groups', 'detail', id, params] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get(`${ENDPOINTS.CONTACTS.GROUPS}/${id}${query}`);
      return {
        group: data.data.group as Group,
        members: data.data.members as Contact[],
        meta: data.meta as PaginationMeta,
      } as GroupDetailResult;
    },
    enabled: Boolean(id && userId && activeOrganization?.id),
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
