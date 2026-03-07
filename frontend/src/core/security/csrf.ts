import axios from 'axios';
import { ENDPOINTS } from '@/core/api/endpoints';
import { resolveApiBaseUrl } from '@/core/api/baseUrl';

const CSRF_COOKIE_NAME = 'csrfToken';
const API_BASE_URL = resolveApiBaseUrl();
let csrfBootstrapPromise: Promise<string | null> | null = null;

function readCookie(name: string) {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie ? document.cookie.split('; ') : [];
  const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!target) {
    return null;
  }

  return decodeURIComponent(target.split('=').slice(1).join('='));
}

export function getCsrfTokenFromCookie() {
  return readCookie(CSRF_COOKIE_NAME);
}

export async function ensureCsrfToken(force = false) {
  const existingToken = !force ? getCsrfTokenFromCookie() : null;
  if (existingToken) {
    return existingToken;
  }

  if (!force && csrfBootstrapPromise) {
    return csrfBootstrapPromise;
  }

  csrfBootstrapPromise = axios
    .get<{ data?: { csrfToken?: string } }>(`${API_BASE_URL}${ENDPOINTS.AUTH.CSRF_TOKEN}`, {
      withCredentials: true,
    })
    .then((response) => response.data?.data?.csrfToken || getCsrfTokenFromCookie())
    .finally(() => {
      csrfBootstrapPromise = null;
    });

  return csrfBootstrapPromise;
}
