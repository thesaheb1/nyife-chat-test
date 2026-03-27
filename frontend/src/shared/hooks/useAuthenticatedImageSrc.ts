import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { apiClient } from '@/core/api/client';
import type { RootState } from '@/core/store';

function shouldFetchWithAuth(src: string) {
  return src.includes('/api/v1/');
}

function isRemoteAbsoluteUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function appendVersion(url: string, version?: string | number | null) {
  if (!version || typeof window === 'undefined' || isRemoteAbsoluteUrl(url)) {
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
  version?: string | number | null,
  options?: {
    fallbackSrc?: string | null;
  }
) {
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const authIsLoading = useSelector((state: RootState) => state.auth.isLoading);
  const fallbackSrc = options?.fallbackSrc || undefined;
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(() => {
    if (!src) {
      return fallbackSrc;
    }

    if (shouldFetchWithAuth(src)) {
      return fallbackSrc;
    }

    return appendVersion(src, version);
  });

  useEffect(() => {
    if (!src) {
      setResolvedSrc(fallbackSrc);
      return undefined;
    }

    const versionedSrc = appendVersion(src, version);

    if (!shouldFetchWithAuth(versionedSrc)) {
      setResolvedSrc(versionedSrc);
      return undefined;
    }

    if (authIsLoading && !accessToken) {
      setResolvedSrc(fallbackSrc);
      return undefined;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    setResolvedSrc(fallbackSrc);

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
          setResolvedSrc(fallbackSrc);
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
  }, [src, version, fallbackSrc, accessToken, authIsLoading]);

  return resolvedSrc;
}

export function useAuthenticatedImageSrc(
  src?: string | null,
  version?: string | number | null
) {
  return useAuthenticatedAssetSrc(src, version);
}
