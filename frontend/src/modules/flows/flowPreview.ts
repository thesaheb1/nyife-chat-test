import type { FlowCategory, MetaFlowDefinition } from '@/core/types';

const FLOW_PREVIEW_SNAPSHOT_TTL_MS = 8 * 60 * 60 * 1000;

export const META_FLOW_MANAGER_URL = 'https://business.facebook.com/wa/manage/flows';

export interface FlowPreviewSnapshot {
  source: 'create' | 'edit';
  flow_id: string | null;
  name: string;
  categories: FlowCategory[];
  json_definition: MetaFlowDefinition;
  meta_flow_id: string | null;
  preview_url: string | null;
  preview_expires_at: string | null;
  saved_at: string;
}

function getPreviewSnapshotKey(source: FlowPreviewSnapshot['source'], flowId?: string | null) {
  return `nyife:flow-preview:${source}:${flowId || 'new'}`;
}

export function buildFlowPreviewPath(options: {
  source: 'create' | 'edit' | 'detail';
  flowId?: string | null;
}) {
  if (options.source === 'create') {
    return '/flows/create/preview';
  }

  if (!options.flowId) {
    return '/flows';
  }

  if (options.source === 'edit') {
    return `/flows/${options.flowId}/edit/preview`;
  }

  return `/flows/${options.flowId}/preview`;
}

export function buildFlowWorkspacePath(options: {
  source: 'create' | 'edit' | 'detail';
  flowId?: string | null;
}) {
  if (options.source === 'create') {
    return '/flows/create';
  }

  if (!options.flowId) {
    return '/flows';
  }

  if (options.source === 'edit') {
    return `/flows/${options.flowId}/edit`;
  }

  return `/flows/${options.flowId}`;
}

export function saveFlowPreviewSnapshot(snapshot: FlowPreviewSnapshot) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getPreviewSnapshotKey(snapshot.source, snapshot.flow_id),
      JSON.stringify(snapshot)
    );
  } catch {
    // Ignore session storage write failures in restrictive environments.
  }
}

export function readFlowPreviewSnapshot(options: {
  source: FlowPreviewSnapshot['source'];
  flowId?: string | null;
}) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(getPreviewSnapshotKey(options.source, options.flowId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as FlowPreviewSnapshot;
    const savedAt = new Date(parsed.saved_at).getTime();
    if (!savedAt || Number.isNaN(savedAt) || Date.now() - savedAt > FLOW_PREVIEW_SNAPSHOT_TTL_MS) {
      window.sessionStorage.removeItem(getPreviewSnapshotKey(options.source, options.flowId));
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

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
