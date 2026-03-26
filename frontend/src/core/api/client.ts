import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { store } from '@/core/store';
import { setCredentials, logout } from '@/core/store/authSlice';
import { resolveApiBaseUrl } from '@/core/api/baseUrl';
import { ENDPOINTS } from '@/core/api/endpoints';
import { ensureCsrfToken, getCsrfTokenFromCookie } from '@/core/security/csrf';
import type { ApiResponse, User } from '@/core/types';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { getOrganizationIdForCurrentPath, getStoredActiveOrganizationId } from '@/modules/organizations/context';

const API_BASE_URL = resolveApiBaseUrl();
const PUBLIC_AUTH_PATHS = [
  '/api/v1/auth/csrf-token',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/verify-email',
  '/api/v1/auth/google',
  '/api/v1/auth/facebook',
];

const ORGANIZATION_HEADER_ALLOWED_PREFIXES = [
  '/api/v1/analytics/',
  '/api/v1/contacts',
  '/api/v1/templates',
  '/api/v1/media',
  '/api/v1/flows',
  '/api/v1/campaigns',
  '/api/v1/chat',
  '/api/v1/whatsapp',
  '/api/v1/automations',
  '/api/v1/support',
  '/api/v1/wallet',
  '/api/v1/subscriptions',
  '/api/v1/settings',
  '/api/v1/developer',
  '/api/v1/notifications',
];

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const SAFE_METHODS = new Set(['get', 'head', 'options']);
type RefreshPayload = { accessToken: string; user: User };
let refreshSessionPromise: Promise<RefreshPayload> | null = null;

function getHeaderValue(headers: AxiosRequestConfig['headers'] | undefined, name: string) {
  if (!headers) {
    return undefined;
  }

  if ('get' in headers && typeof headers.get === 'function') {
    const value = headers.get(name);
    return typeof value === 'string' ? value : undefined;
  }

  const match = Object.entries(headers as Record<string, unknown>).find(
    ([key]) => key.toLowerCase() === name.toLowerCase()
  );

  return typeof match?.[1] === 'string' ? match[1] : undefined;
}

function normalizeRetryUrl(url?: string) {
  if (!url) {
    return url;
  }

  if (url.startsWith(API_BASE_URL)) {
    const relativeUrl = url.slice(API_BASE_URL.length);
    return relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
  }

  try {
    const parsed = new URL(url, API_BASE_URL);
    const apiBaseOrigin = new URL(API_BASE_URL).origin;

    if (parsed.origin === apiBaseOrigin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return url;
  }

  return url;
}

function isAuthRequest(url?: string) {
  return !!url && url.includes('/api/v1/auth/');
}

function getRequestPath(url?: string) {
  if (!url) {
    return '';
  }

  try {
    return new URL(url, API_BASE_URL).pathname;
  } catch {
    return url;
  }
}

function shouldAttachOrganizationHeader(url?: string) {
  const path = getRequestPath(url);

  if (!path || path.startsWith('/api/v1/admin/') || path.startsWith('/api/v1/auth/')) {
    return false;
  }

  if (path === '/api/v1/settings/public') {
    return false;
  }

  return ORGANIZATION_HEADER_ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export async function refreshSession() {
  if (refreshSessionPromise) {
    return refreshSessionPromise;
  }

  refreshSessionPromise = (async () => {
    const csrfToken = await ensureCsrfToken();
    const { data } = await axios.post<ApiResponse<RefreshPayload>>(
      `${API_BASE_URL}${ENDPOINTS.AUTH.REFRESH}`,
      {},
      {
        withCredentials: true,
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
      }
    );

    store.dispatch(
      setCredentials({
        accessToken: data.data.accessToken,
        user: data.data.user,
      })
    );

    return data.data;
  })()
    .catch((error) => {
      store.dispatch(logout());
      throw error;
    })
    .finally(() => {
      refreshSessionPromise = null;
    });

  return refreshSessionPromise;
}

// Request interceptor: attach access token
apiClient.interceptors.request.use(async (config) => {
  const { accessToken, user } = store.getState().auth;
  const isPublicAuthRequest = PUBLIC_AUTH_PATHS.some((path) => config.url?.includes(path));
  const method = (config.method || 'get').toLowerCase();
  const isFormDataPayload = typeof FormData !== 'undefined' && config.data instanceof FormData;

  config.headers = config.headers || {};

  if (isFormDataPayload && config.headers) {
    delete (config.headers as Record<string, unknown>)['Content-Type'];
    delete (config.headers as Record<string, unknown>)['content-type'];
  }

  if (accessToken && !isPublicAuthRequest) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  if (typeof window !== 'undefined' && !isPublicAuthRequest && shouldAttachOrganizationHeader(config.url)) {
    const organizationId =
      getOrganizationIdForCurrentPath(window.location.pathname, user?.id) ||
      getStoredActiveOrganizationId(user?.id);

    if (organizationId) {
      config.headers['X-Organization-Id'] = organizationId;
    }
  }

  if (!SAFE_METHODS.has(method) && !config.url?.includes(ENDPOINTS.AUTH.CSRF_TOKEN)) {
    let csrfToken = getCsrfTokenFromCookie();

    if (!csrfToken && isAuthRequest(config.url)) {
      csrfToken = await ensureCsrfToken();
    }

    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  return config;
});

// Response interceptor: handle 401 with token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    const applyFriendlyMessage = (targetError: unknown) => {
      const friendlyMessage = getApiErrorMessage(targetError);

      if ((targetError as { response?: { data?: { message?: string } } })?.response?.data) {
        (targetError as { response: { data: { message?: string } } }).response.data.message = friendlyMessage;
      }

      if (targetError && typeof targetError === 'object' && 'message' in targetError) {
        (targetError as Error).message = friendlyMessage;
      }
    };

    if (error.response?.status !== 401 || originalRequest._retry) {
      applyFriendlyMessage(error);
      return Promise.reject(error);
    }

    // Don't retry refresh or login requests
    if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/login')) {
      applyFriendlyMessage(error);
      return Promise.reject(error);
    }

    const requestHadAuthContext = Boolean(
      getHeaderValue(originalRequest.headers, 'Authorization') || store.getState().auth.accessToken
    );

    if (!requestHadAuthContext) {
      applyFriendlyMessage(error);
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const { accessToken } = await refreshSession();
      const retryUrl = normalizeRetryUrl(originalRequest.url);
      const retryHeaders = {
        ...(originalRequest.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      };

      return apiClient.request({
        ...originalRequest,
        baseURL: API_BASE_URL,
        url: retryUrl,
        headers: retryHeaders,
      });
    } catch (refreshError) {
      window.location.href = '/login';
      applyFriendlyMessage(refreshError);
      return Promise.reject(refreshError);
    }
  }
);
