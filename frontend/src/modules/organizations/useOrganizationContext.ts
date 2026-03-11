import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import type { ApiResponse, Organization } from '@/core/types';
import {
  getOrganizationSlugFromPath,
  resolvePreferredOrganization,
  setStoredActiveOrganization,
  syncStoredOrganizationRegistry,
} from './context';

export const ACCESSIBLE_ORGANIZATIONS_QUERY_KEY = ['organizations', 'me'] as const;

export function useAccessibleOrganizations(enabled = true) {
  return useQuery<Organization[]>({
    queryKey: ACCESSIBLE_ORGANIZATIONS_QUERY_KEY,
    enabled,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Organization[]>>(`${ENDPOINTS.ORGANIZATIONS.BASE}/me?limit=100`);
      return data.data;
    },
  });
}

export function useOrganizationContext(preferredSlug?: string | null, enabled = true) {
  const location = useLocation();
  const query = useAccessibleOrganizations(enabled);
  const routeSlug = getOrganizationSlugFromPath(location.pathname);
  const resolvedPreferredSlug = preferredSlug || routeSlug || null;

  const activeOrganization = useMemo(() => {
    if (!query.data?.length) {
      return null;
    }

    return resolvePreferredOrganization(query.data, resolvedPreferredSlug);
  }, [query.data, resolvedPreferredSlug]);

  useEffect(() => {
    if (!query.data?.length) {
      return;
    }

    syncStoredOrganizationRegistry(query.data);

    if (activeOrganization) {
      setStoredActiveOrganization(activeOrganization);
    }
  }, [activeOrganization, query.data]);

  return {
    ...query,
    organizations: query.data || [],
    activeOrganization,
  };
}
