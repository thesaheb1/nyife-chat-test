import { ArrowLeft, Copy, Save, Send, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { FlowAvailableAction, WhatsAppFlow } from '@/core/types';
import { FlowStatusBadges } from './FlowStatusBadges';

export function FlowBuilderHeader({
  isEdit,
  flow,
  isBusy,
  isReadOnly,
  publishDisabled,
  publishDisabledReason,
  availableActions,
  onBack,
  onClone,
  onDeprecate,
  onDelete,
  onPublish,
  onSaveDraft,
}: {
  isEdit: boolean;
  flow?: WhatsAppFlow | null;
  isBusy?: boolean;
  isReadOnly?: boolean;
  publishDisabled?: boolean;
  publishDisabledReason?: string;
  availableActions: FlowAvailableAction[];
  onBack: () => void;
  onClone: () => void;
  onDeprecate: () => void;
  onDelete: () => void;
  onPublish: () => void;
  onSaveDraft: () => void;
}) {
  const title = isEdit ? (isReadOnly ? 'Flow builder' : 'Edit flow') : 'Create flow';
  const canSaveDraft = !isEdit || availableActions.includes('edit');
  const canPublish = !isEdit || availableActions.includes('publish');

  return (
    <div className="sticky top-0 z-20 rounded-3xl border bg-background/95 p-4 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/85">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="mt-0.5 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
                <FlowStatusBadges
                  flow={flow || {
                    status: 'DRAFT',
                    meta_status: null,
                    can_send_message: null,
                    has_local_changes: false,
                  }}
                />
                {flow?.meta_flow_id ? <Badge variant="secondary">Meta linked</Badge> : null}
                {isReadOnly ? <Badge variant="secondary">Read-only</Badge> : null}
              </div>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Draft flows stay editable here. Published, throttled, blocked, and deprecated flows open in read-only mode so you can safely review them and use the lifecycle actions allowed for their current status.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            {availableActions.includes('clone') ? (
              <Button className="w-full sm:w-auto" variant="outline" onClick={onClone} disabled={isBusy}>
                <Copy className="mr-2 h-4 w-4" />
                Clone
              </Button>
            ) : null}
            {availableActions.includes('deprecate') ? (
              <Button className="w-full sm:w-auto" variant="outline" onClick={onDeprecate} disabled={isBusy}>
                <Trash2 className="mr-2 h-4 w-4" />
                Deprecate
              </Button>
            ) : null}
            {availableActions.includes('delete') ? (
              <Button className="w-full sm:w-auto" variant="outline" onClick={onDelete} disabled={isBusy}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            ) : null}
            {canPublish ? (
              <Button
                className="w-full sm:w-auto"
                variant="outline"
                onClick={onPublish}
                disabled={isBusy || publishDisabled}
                title={publishDisabled ? publishDisabledReason : undefined}
              >
                <Send className="mr-2 h-4 w-4" />
                Publish
              </Button>
            ) : null}
            {canSaveDraft ? (
              <Button className="w-full sm:w-auto" onClick={onSaveDraft} disabled={isBusy || isReadOnly}>
                <Save className="mr-2 h-4 w-4" />
                Save draft
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
