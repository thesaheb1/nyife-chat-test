import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import type {
  ApiResponse,
  EmbeddedSignupCompleteResult,
  EmbeddedSignupPreviewResult,
  WaAccount,
  WaAccountHealthResult,
} from '@/core/types';

interface AccountListResponse {
  accounts: WaAccount[];
}

export function useWhatsAppAccounts() {
  return useQuery<WaAccount[]>({
    queryKey: ['wa-accounts'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AccountListResponse>>(ENDPOINTS.WHATSAPP.ACCOUNTS);
      return data.data.accounts;
    },
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
  return useQuery<WaAccountHealthResult>({
    queryKey: ['wa-accounts', 'health', id],
    enabled: Boolean(id) && enabled,
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
      const { data } = await apiClient.post<ApiResponse<{ account: WaAccount }>>(
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
