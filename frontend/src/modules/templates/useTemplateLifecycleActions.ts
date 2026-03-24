import { useState } from 'react';
import type { Template } from '@/core/types';
import { runTemplateActionToast } from './templateToast';
import { useDeleteTemplate, usePublishTemplate, useSyncTemplates } from './useTemplates';

export function useTemplateLifecycleActions(options: {
  onDeleted?: (template: Template) => void;
} = {}) {
  const publishTemplate = usePublishTemplate();
  const syncTemplates = useSyncTemplates();
  const deleteTemplate = useDeleteTemplate();
  const [publishTarget, setPublishTarget] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const syncTemplate = async (scopeKey: string, template?: Template | null) => {
    setBusyKey(scopeKey);
    try {
      return await runTemplateActionToast(syncTemplates.mutateAsync(template?.wa_account_id || undefined), {
        loading: 'Syncing templates from Meta...',
        success: (result) => `Synced ${result.synced} templates (${result.created} created, ${result.updated} updated).`,
        error: 'Failed to sync templates.',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const confirmPublish = async () => {
    if (!publishTarget) {
      return null;
    }

    setBusyKey(`publish:${publishTarget.id}`);
    try {
      const result = await runTemplateActionToast(
        publishTemplate.mutateAsync({
          id: publishTarget.id,
          wa_account_id: publishTarget.wa_account_id || undefined,
        }),
        {
          loading: 'Submitting template to Meta...',
          success: 'Template submitted to Meta for review.',
          error: 'Failed to submit template.',
        }
      );
      setPublishTarget(null);
      return result;
    } finally {
      setBusyKey(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return null;
    }

    const target = deleteTarget;
    setBusyKey(`delete:${target.id}`);
    try {
      await runTemplateActionToast(deleteTemplate.mutateAsync(target.id), {
        loading: 'Deleting template...',
        success: 'Template deleted.',
        error: 'Failed to delete template.',
      });
      setDeleteTarget(null);
      options.onDeleted?.(target);
      return target;
    } finally {
      setBusyKey(null);
    }
  };

  return {
    publishTarget,
    deleteTarget,
    busyKey,
    publishTemplate,
    syncTemplates,
    deleteTemplate,
    setPublishTarget,
    setDeleteTarget,
    syncTemplate,
    confirmPublish,
    confirmDelete,
  };
}
