const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isLoopbackHost(hostname: string) {
  return LOOPBACK_HOSTS.has(hostname);
}

function normalizeBaseUrl(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function resolveApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_URL;

  if (typeof window === 'undefined') {
    return normalizeBaseUrl(configuredBaseUrl || 'http://localhost:3000');
  }

  const fallbackBaseUrl = import.meta.env.DEV
    ? window.location.origin
    : `${window.location.protocol}//${window.location.hostname}:3000`;

  if (!configuredBaseUrl) {
    return fallbackBaseUrl;
  }

  try {
    const configuredUrl = new URL(configuredBaseUrl);

    // In local development, follow the browser host when the configured API URL
    // points at loopback. This avoids localhost/127.0.0.1/LAN mismatches.
    if (
      import.meta.env.DEV &&
      isLoopbackHost(configuredUrl.hostname)
    ) {
      return normalizeBaseUrl(window.location.origin);
    }

    return normalizeBaseUrl(configuredUrl.toString());
  } catch {
    return fallbackBaseUrl;
  }
}
