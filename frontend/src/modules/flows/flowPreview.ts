export const META_FLOW_MANAGER_URL = 'https://business.facebook.com/wa/manage/flows';

export function isFlowPreviewExpired(previewExpiresAt?: string | null) {
  if (!previewExpiresAt) {
    return true;
  }

  const parsed = new Date(previewExpiresAt);
  if (Number.isNaN(parsed.getTime())) {
    return true;
  }

  return parsed.getTime() <= Date.now();
}
