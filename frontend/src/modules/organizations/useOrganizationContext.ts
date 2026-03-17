import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { sessionQueryKey } from '@/core/queryKeys';
import type { ApiResponse, Organization } from '@/core/types';
import type { RootState } from '@/core/store';
import {
  getOrganizationSlugFromPath,
  resolvePreferredOrganization,
  setStoredActiveOrganization,
  syncStoredOrganizationRegistry,
  clearStoredActiveOrganization,
  clearStoredOrganizationRegistry,
} from './context';

export function accessibleOrganizationsQueryKey(userId?: string | null) {
  return sessionQueryKey(['organizations', 'me'] as const, userId);
}

export function useAccessibleOrganizations(enabled = true) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  return useQuery<Organization[]>({
    queryKey: accessibleOrganizationsQueryKey(userId),
    enabled: enabled && Boolean(userId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Organization[]>>(`${ENDPOINTS.ORGANIZATIONS.BASE}/me?limit=100`);
      return data.data;
    },
  });
}

export function useOrganizationContext(preferredSlug?: string | null, enabled = true) {
  const location = useLocation();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const query = useAccessibleOrganizations(enabled);
  const routeSlug = getOrganizationSlugFromPath(location.pathname);
  const resolvedPreferredSlug = preferredSlug || routeSlug || null;

  const activeOrganization = useMemo(() => {
    if (!query.data?.length) {
      return null;
    }

    return resolvePreferredOrganization(query.data, userId, resolvedPreferredSlug);
  }, [query.data, resolvedPreferredSlug, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    if (!query.data?.length) {
      clearStoredActiveOrganization(userId);
      clearStoredOrganizationRegistry(userId);
      return;
    }

    syncStoredOrganizationRegistry(userId, query.data);

    if (activeOrganization) {
      setStoredActiveOrganization(userId, activeOrganization);
    }
  }, [activeOrganization, query.data, userId]);

  return {
    ...query,
    organizations: query.data || [],
    activeOrganization,
  };
}
