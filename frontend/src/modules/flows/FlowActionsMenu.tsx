import {
  ExternalLink,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type FlowActionKey =
  | 'view'
  | 'edit'
  | 'save_to_meta'
  | 'publish'
  | 'open_meta_preview'
  | 'delete';

const FLOW_ACTION_LABELS: Record<FlowActionKey, string> = {
  view: 'View details',
  edit: 'Edit',
  save_to_meta: 'Save to Meta',
  publish: 'Publish',
  open_meta_preview: 'Open Meta preview',
  delete: 'Delete',
};

export function FlowActionsMenu({
  actions,
  isBusy,
  onView,
  onEdit,
  onSaveToMeta,
  onPublish,
  onOpenMetaPreview,
  onDelete,
}: {
  actions: FlowActionKey[];
  isBusy?: boolean;
  onView: () => void;
  onEdit: () => void;
  onSaveToMeta: () => void;
  onPublish: () => void;
  onOpenMetaPreview: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          data-row-click-ignore="true"
          onClick={(event) => event.stopPropagation()}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
          <span className="sr-only">Open flow actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        data-row-click-ignore="true"
        onClick={(event) => event.stopPropagation()}
      >
        {actions.includes('view') ? (
          <DropdownMenuItem onClick={onView}>
            <Eye className="mr-2 h-4 w-4" />
            {FLOW_ACTION_LABELS.view}
          </DropdownMenuItem>
        ) : null}
        {actions.includes('edit') ? (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            {FLOW_ACTION_LABELS.edit}
          </DropdownMenuItem>
        ) : null}
        {actions.includes('save_to_meta') ? (
          <DropdownMenuItem onClick={onSaveToMeta}>
            <WandSparkles className="mr-2 h-4 w-4" />
            {FLOW_ACTION_LABELS.save_to_meta}
          </DropdownMenuItem>
        ) : null}
        {actions.includes('publish') ? (
          <DropdownMenuItem onClick={onPublish}>
            <Send className="mr-2 h-4 w-4" />
            {FLOW_ACTION_LABELS.publish}
          </DropdownMenuItem>
        ) : null}
        {actions.includes('open_meta_preview') ? (
          <DropdownMenuItem onClick={onOpenMetaPreview}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {FLOW_ACTION_LABELS.open_meta_preview}
          </DropdownMenuItem>
        ) : null}
        {actions.includes('delete') ? (
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            {FLOW_ACTION_LABELS.delete}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
