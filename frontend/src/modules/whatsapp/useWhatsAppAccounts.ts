import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { organizationQueryKey } from '@/core/queryKeys';
import type { RootState } from '@/core/store';
import type {
  ApiResponse,
  EmbeddedSignupCompleteResult,
  EmbeddedSignupPreviewResult,
  WaAccount,
  WaAccountHealthResult,
  WaAccountRepairResult,
} from '@/core/types';
import { useOrganizationContext } from '@/modules/organizations/useOrganizationContext';

interface AccountListResponse {
  accounts: WaAccount[];
}

export function useWhatsAppAccounts() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();

  return useQuery<WaAccount[]>({
    queryKey: organizationQueryKey(['wa-accounts'] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AccountListResponse>>(ENDPOINTS.WHATSAPP.ACCOUNTS);
      return data.data.accounts;
    },
    enabled: Boolean(userId && activeOrganization?.id),
  });
}

export function useEmbeddedSignupPreview() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data } = await apiClient.post<ApiResponse<EmbeddedSignupPreviewResult>>(
        ENDPOINTS.WHATSAPP.EMBEDDED_SIGNUP_PREVIEW,
        { code }
      );
      return data.data;
    },
  });
}

export function useEmbeddedSignupComplete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      signup_session_id: string;
      waba_id?: string | null;
      phone_number_ids: string[];
    }) => {
      const { data } = await apiClient.post<ApiResponse<EmbeddedSignupCompleteResult>>(
        ENDPOINTS.WHATSAPP.EMBEDDED_SIGNUP,
        payload
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa-accounts'] });
    },
  });
}

export function useWhatsAppAccountHealth(id: string | null | undefined, enabled = true) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();

  return useQuery<WaAccountHealthResult>({
    queryKey: organizationQueryKey(['wa-accounts', 'health', id] as const, userId, activeOrganization?.id),
    enabled: Boolean(id) && enabled && Boolean(userId && activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<WaAccountHealthResult>>(
        ENDPOINTS.WHATSAPP.ACCOUNT_HEALTH(String(id))
      );
      return data.data;
    },
  });
}

export function useRefreshWhatsAppAccountHealth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.get<ApiResponse<WaAccountHealthResult>>(
        ENDPOINTS.WHATSAPP.ACCOUNT_HEALTH(id)
      );
      return data.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['wa-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['wa-accounts', 'health', id] });
    },
  });
}

export function useReconcileWhatsAppAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<WaAccountRepairResult>>(
        ENDPOINTS.WHATSAPP.ACCOUNT_RECONCILE(id),
        {}
      );
      return data.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['wa-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['wa-accounts', 'health', id] });
    },
  });
}

export function useDisconnectWhatsAppAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${ENDPOINTS.WHATSAPP.ACCOUNTS}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wa-accounts'] });
    },
  });
}
