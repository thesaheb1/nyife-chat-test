import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Template } from '@/core/types';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { TEMPLATE_TYPE_LABELS, resolveTemplateMetaStatus } from './templateCatalog';
import { getTemplatePublishPreflight } from './templatePreflight';

function getDeleteCaveat(template: Template | null) {
  if (!template) {
    return null;
  }

  const effectiveMetaStatus = resolveTemplateMetaStatus(template);

  if (effectiveMetaStatus === 'PENDING_DELETION') {
    return 'Meta already marked this template as pending deletion. Nyife will remove the local record without sending another Meta delete request.';
  }

  if (effectiveMetaStatus === 'APPROVED') {
    return 'Deleting an approved template on Meta blocks recreating the same template name for 30 days.';
  }

  if (['DISABLED', 'DELETED', 'ARCHIVED', 'LIMIT_EXCEEDED'].includes(effectiveMetaStatus || '')) {
    return 'Nyife will clean up the local record only. Meta already treats this template as inactive in its current lifecycle state.';
  }

  return 'If the template exists on Meta, Nyife will also attempt the matching Meta cleanup where supported.';
}

export function TemplateActionDialogs({
  publishTarget,
  deleteTarget,
  publishPending,
  deletePending,
  activeAccountCount,
  onPublishOpenChange,
  onDeleteOpenChange,
  onConfirmPublish,
  onConfirmDelete,
}: {
  publishTarget: Template | null;
  deleteTarget: Template | null;
  publishPending: boolean;
  deletePending: boolean;
  activeAccountCount: number;
  onPublishOpenChange: (open: boolean) => void;
  onDeleteOpenChange: (open: boolean) => void;
  onConfirmPublish: () => Promise<unknown>;
  onConfirmDelete: () => Promise<unknown>;
}) {
  const publishChecks = getTemplatePublishPreflight(publishTarget);

  return (
    <>
      <Dialog open={!!publishTarget} onOpenChange={onPublishOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Submit template to Meta</DialogTitle>
            <DialogDescription>
              Only unpublished drafts can be submitted. Nyife will create the template on Meta and immediately send it for review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <div className="font-semibold">{publishTarget?.display_name || publishTarget?.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {publishTarget ? `${TEMPLATE_TYPE_LABELS[publishTarget.type]} · ${publishTarget.language} · ${publishTarget.category}` : ''}
              </div>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="mb-3 text-sm font-semibold">Publish preflight</div>
              <div className="space-y-3">
                {publishChecks.map((check) => (
                  <div key={check.label} className="flex items-start gap-3">
                    {check.tone === 'ready' ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    )}
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">{check.label}</div>
                      <div className="text-xs text-muted-foreground">{check.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onPublishOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => void onConfirmPublish()} disabled={publishPending || activeAccountCount === 0}>
              {publishPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit to Meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={onDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                {deleteTarget?.display_name || deleteTarget?.name} will be removed from Nyife.
              </span>
              <span className="mt-2 block">
                {getDeleteCaveat(deleteTarget)}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void onConfirmDelete()} disabled={deletePending}>
              {deletePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
