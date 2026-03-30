import type { FlowStatus } from '@/core/types';

export const FLOW_STATUS_LABELS: Record<FlowStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  THROTTLED: 'Throttled',
  BLOCKED: 'Blocked',
  DEPRECATED: 'Deprecated',
};

export const FLOW_STATUS_CLASSES: Record<FlowStatus, string> = {
  DRAFT: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
  PUBLISHED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
  THROTTLED: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
  BLOCKED: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200',
  DEPRECATED: 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200',
};

export function normalizeFlowStatusToken(status: string | null | undefined): FlowStatus | null {
  const normalized = String(status || '').trim().toUpperCase();

  if (normalized.includes('BLOCK')) {
    return 'BLOCKED';
  }

  if (normalized.includes('THROTTL')) {
    return 'THROTTLED';
  }

  if (normalized.includes('DEPREC')) {
    return 'DEPRECATED';
  }

  if (normalized.includes('PUBLISH')) {
    return 'PUBLISHED';
  }

  if (normalized === 'DRAFT') {
    return 'DRAFT';
  }

  return null;
}

