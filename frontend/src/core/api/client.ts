import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { store } from '@/core/store';
import { setCredentials, logout } from '@/core/store/authSlice';
import { resolveApiBaseUrl } from '@/core/api/baseUrl';
import { ENDPOINTS } from '@/core/api/endpoints';
import { ensureCsrfToken, getCsrfTokenFromCookie } from '@/core/security/csrf';
import type { ApiResponse, User } from '@/core/types';

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

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const SAFE_METHODS = new Set(['get', 'head', 'options']);
type RefreshPayload = { accessToken: string; user: User };
let refreshSessionPromise: Promise<RefreshPayload> | null = null;

function isAuthRequest(url?: string) {
  return !!url && url.includes('/api/v1/auth/');
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
  const { accessToken } = store.getState().auth;
  const isPublicAuthRequest = PUBLIC_AUTH_PATHS.some((path) => config.url?.includes(path));
  const method = (config.method || 'get').toLowerCase();
  const isFormDataPayload = typeof FormData !== 'undefined' && config.data instanceof FormData;

  if (isFormDataPayload && config.headers) {
    delete (config.headers as Record<string, unknown>)['Content-Type'];
    delete (config.headers as Record<string, unknown>)['content-type'];
  }

  if (accessToken && !isPublicAuthRequest) {
    config.headers.Authorization = `Bearer ${accessToken}`;
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

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't retry refresh or login requests
    if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/login')) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const { accessToken } = await refreshSession();

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      }
      return apiClient(originalRequest);
    } catch (refreshError) {
      window.location.href = '/login';
      return Promise.reject(refreshError);
    }
  }
);
