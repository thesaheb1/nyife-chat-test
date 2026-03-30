import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Eye,
  Save,
  Send,
  Trash2,
  Upload,
  WandSparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { WhatsAppFlow } from '@/core/types';

export function FlowBuilderHeader({
  isEdit,
  flow,
  isBusy,
  hasUnsupportedDataExchange,
  onBack,
  onOpenPreview,
  onOpenOfficialPreview,
  onOpenMetaFlowBuilder,
  onOpenImportJson,
  onDuplicate,
  onDeprecate,
  onDelete,
  onSaveToMeta,
  onPublish,
  onSaveDraft,
}: {
  isEdit: boolean;
  flow?: WhatsAppFlow | null;
  isBusy?: boolean;
  hasUnsupportedDataExchange?: boolean;
  onBack: () => void;
  onOpenPreview: () => void;
  onOpenOfficialPreview: () => void;
  onOpenMetaFlowBuilder: () => void;
  onOpenImportJson: () => void;
  onDuplicate: () => void;
  onDeprecate: () => void;
  onDelete: () => void;
  onSaveToMeta: () => void;
  onPublish: () => void;
  onSaveDraft: () => void;
}) {
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
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {isEdit ? 'Edit flow' : 'Create flow'}
                </h1>
                {flow?.status ? <Badge variant="outline">{flow.status}</Badge> : null}
                {flow?.meta_status && flow.meta_status !== flow.status ? (
                  <Badge variant="secondary">{flow.meta_status}</Badge>
                ) : null}
                {flow?.meta_flow_id ? <Badge variant="secondary">Meta linked</Badge> : null}
                {flow?.can_send_message === false ? <Badge variant="destructive">Send blocked</Badge> : null}
              </div>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Build compact static WhatsApp Flows, import Meta-authored JSON, preview locally, and verify the official Meta preview before publishing.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button variant="outline" onClick={onOpenPreview} disabled={isBusy}>
              <Eye className="mr-2 h-4 w-4" />
              Preview workspace
            </Button>
            <Button
              variant="outline"
              onClick={onOpenOfficialPreview}
              disabled={isBusy || !flow?.preview_url}
              title={flow?.preview_url ? 'Open the current official Meta preview' : 'Save this flow to Meta first to unlock the official preview'}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Official preview
            </Button>
            <Button variant="outline" onClick={onOpenMetaFlowBuilder} disabled={isBusy}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Meta Flow Builder
            </Button>
            <Button variant="outline" onClick={onOpenImportJson} disabled={isBusy}>
              <Upload className="mr-2 h-4 w-4" />
              Import JSON
            </Button>
            {isEdit ? (
              <Button variant="outline" onClick={onDuplicate} disabled={isBusy}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </Button>
            ) : null}
            {isEdit && flow?.meta_flow_id && flow.status !== 'DEPRECATED' ? (
              <Button variant="outline" onClick={onDeprecate} disabled={isBusy}>
                <Trash2 className="mr-2 h-4 w-4" />
                Deprecate
              </Button>
            ) : null}
            {isEdit ? (
              <Button variant="outline" onClick={onDelete} disabled={isBusy}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            ) : null}
            <Button variant="outline" onClick={onSaveToMeta} disabled={isBusy || hasUnsupportedDataExchange}>
              <WandSparkles className="mr-2 h-4 w-4" />
              Save to Meta
            </Button>
            <Button variant="outline" onClick={onPublish} disabled={isBusy || hasUnsupportedDataExchange}>
              <Send className="mr-2 h-4 w-4" />
              Publish
            </Button>
            <Button onClick={onSaveDraft} disabled={isBusy}>
              <Save className="mr-2 h-4 w-4" />
              Save draft
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
