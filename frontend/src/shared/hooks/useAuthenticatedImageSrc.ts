import { useEffect, useState } from 'react';
import { apiClient } from '@/core/api/client';

function shouldFetchWithAuth(src: string) {
  return src.includes('/api/v1/');
}

function appendVersion(url: string, version?: string | number | null) {
  if (!version || typeof window === 'undefined') {
    return url;
  }

  try {
    const nextUrl = new URL(url, window.location.origin);
    nextUrl.searchParams.set('v', String(version));
    return nextUrl.toString();
  } catch {
    return url;
  }
}

export function useAuthenticatedAssetSrc(
  src?: string | null,
  version?: string | number | null
) {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(() => {
    if (!src) {
      return undefined;
    }

    return shouldFetchWithAuth(src) ? undefined : appendVersion(src, version);
  });

  useEffect(() => {
    if (!src) {
      setResolvedSrc(undefined);
      return undefined;
    }

    const versionedSrc = appendVersion(src, version);

    if (!shouldFetchWithAuth(versionedSrc)) {
      setResolvedSrc(versionedSrc);
      return undefined;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    const loadAsset = async () => {
      try {
        const response = await apiClient.get<Blob>(versionedSrc, {
          responseType: 'blob',
        });

        objectUrl = URL.createObjectURL(response.data);
        if (!cancelled) {
          setResolvedSrc(objectUrl);
        }
      } catch {
        if (!cancelled) {
          setResolvedSrc(undefined);
        }
      }
    };

    void loadAsset();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src, version]);

  return resolvedSrc;
}

export function useAuthenticatedImageSrc(
  src?: string | null,
  version?: string | number | null
) {
  return useAuthenticatedAssetSrc(src, version);
}
