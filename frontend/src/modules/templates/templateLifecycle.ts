import type { Template } from '@/core/types';

export type TemplateActionKey = 'view' | 'edit' | 'publish' | 'sync' | 'delete';

const EDITABLE_META_STATUSES = new Set(['APPROVED', 'REJECTED', 'PAUSED']);
const PENDING_META_STATUSES = new Set(['PENDING', 'IN_APPEAL', 'APPEAL_REQUESTED', 'PENDING_DELETION']);
const DISABLED_META_STATUSES = new Set(['DISABLED', 'DELETED', 'ARCHIVED', 'LIMIT_EXCEEDED']);
const DELETE_ALLOWED_META_STATUSES = new Set([
  ...EDITABLE_META_STATUSES,
  ...PENDING_META_STATUSES,
  ...DISABLED_META_STATUSES,
]);
const TEMPLATE_ACTION_KEYS: TemplateActionKey[] = ['view', 'edit', 'publish', 'sync', 'delete'];

export const TEMPLATE_ACTION_LABELS: Record<TemplateActionKey, string> = {
  view: 'Preview template',
  edit: 'Edit template',
  publish: 'Submit to Meta',
  sync: 'Sync from Meta',
  delete: 'Delete template',
};

export const TEMPLATE_META_STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Meta approved',
  PENDING: 'Meta in review',
  IN_APPEAL: 'In appeal',
  APPEAL_REQUESTED: 'Appeal requested',
  PENDING_DELETION: 'Pending deletion',
  REJECTED: 'Meta rejected',
  PAUSED: 'Meta paused',
  DISABLED: 'Meta disabled',
  DELETED: 'Meta deleted',
  ARCHIVED: 'Archived',
  LIMIT_EXCEEDED: 'Limit exceeded',
};

export const TEMPLATE_META_STATUS_CLASSES: Record<string, string> = {
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
  IN_APPEAL: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-200',
  APPEAL_REQUESTED: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-200',
  PENDING_DELETION: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-200',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200',
  PAUSED: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-200',
  DISABLED: 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200',
  DELETED: 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200',
  ARCHIVED: 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200',
  LIMIT_EXCEEDED: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200',
};

export function resolveTemplateMetaStatus(
  template: Pick<Template, 'status' | 'meta_status_raw' | 'meta_template_id'> | null | undefined
) {
  const rawMetaStatus = template?.meta_status_raw?.trim().toUpperCase();
  if (rawMetaStatus) {
    return rawMetaStatus;
  }

  const compatibilityMap: Partial<Record<Template['status'], string>> = {
    pending: 'PENDING',
    approved: 'APPROVED',
    paused: 'PAUSED',
    disabled: 'DISABLED',
  };

  if (template?.meta_template_id) {
    compatibilityMap.rejected = 'REJECTED';
  }

  return compatibilityMap[template?.status || 'draft'] || null;
}

export function canPublishTemplate(
  template: Pick<Template, 'status' | 'meta_template_id'> | null | undefined
) {
  return Boolean(template && !template.meta_template_id && ['draft', 'rejected'].includes(template.status));
}

export function canEditTemplate(
  template: Pick<Template, 'status' | 'meta_status_raw' | 'meta_template_id'> | null | undefined
) {
  if (canPublishTemplate(template)) {
    return true;
  }

  const effectiveMetaStatus = resolveTemplateMetaStatus(template);
  return effectiveMetaStatus ? EDITABLE_META_STATUSES.has(effectiveMetaStatus) : false;
}

export function canDeleteTemplate(
  template: Pick<Template, 'status' | 'meta_status_raw' | 'meta_template_id'> | null | undefined
) {
  const effectiveMetaStatus = resolveTemplateMetaStatus(template);
  if (!effectiveMetaStatus) {
    return true;
  }

  return DELETE_ALLOWED_META_STATUSES.has(effectiveMetaStatus);
}

export function canSyncTemplate(
  template: Pick<Template, 'status' | 'meta_status_raw' | 'meta_template_id' | 'wa_account_id' | 'waba_id'> | null | undefined
) {
  return Boolean(
    resolveTemplateMetaStatus(template)
    || template?.meta_template_id
    || template?.wa_account_id
    || template?.waba_id
  );
}

export function getTemplateMetaFieldLocks(
  template: Pick<Template, 'status' | 'meta_status_raw' | 'meta_template_id'> | null | undefined
) {
  const effectiveMetaStatus = resolveTemplateMetaStatus(template);
  const metaManagedIdentity = Boolean(template?.meta_template_id || effectiveMetaStatus);

  return {
    name: metaManagedIdentity,
    language: metaManagedIdentity,
    type: metaManagedIdentity,
    wa_account_id: metaManagedIdentity,
    category: effectiveMetaStatus === 'APPROVED',
  };
}

export function hasTemplateMetaLinkageGap(
  template: Pick<Template, 'status' | 'meta_status_raw' | 'meta_template_id'> | null | undefined
) {
  return Boolean(resolveTemplateMetaStatus(template) && !template?.meta_template_id);
}

export function getTemplateAvailableActions(template: Template): TemplateActionKey[] {
  const declared = template.available_actions?.filter(
    (action): action is TemplateActionKey => TEMPLATE_ACTION_KEYS.includes(action as TemplateActionKey)
  );

  if (declared?.length) {
    return Array.from(new Set<TemplateActionKey>(['view', ...declared]));
  }

  const actions = new Set<TemplateActionKey>(['view']);

  if (canEditTemplate(template)) {
    actions.add('edit');
  }
  if (canPublishTemplate(template)) {
    actions.add('publish');
  }
  if (canSyncTemplate(template)) {
    actions.add('sync');
  }
  if (canDeleteTemplate(template)) {
    actions.add('delete');
  }

  return Array.from(actions);
}

export function getTemplateMetaStatusLabel(status: string | null) {
  if (!status) {
    return null;
  }

  return TEMPLATE_META_STATUS_LABELS[status] || status.replace(/_/g, ' ').toLowerCase();
}
