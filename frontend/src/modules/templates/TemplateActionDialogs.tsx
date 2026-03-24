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
import { Loader2 } from 'lucide-react';
import { TEMPLATE_TYPE_LABELS, resolveTemplateMetaStatus } from './templateCatalog';

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
  return (
    <>
      <Dialog open={!!publishTarget} onOpenChange={onPublishOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Submit template to Meta</DialogTitle>
            <DialogDescription>
              Only unpublished drafts can be submitted. Nyife will use the connected WhatsApp account automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <div className="font-semibold">{publishTarget?.display_name || publishTarget?.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {publishTarget ? TEMPLATE_TYPE_LABELS[publishTarget.type] : ''} template
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
