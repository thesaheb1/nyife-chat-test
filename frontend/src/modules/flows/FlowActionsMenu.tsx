import {
  Copy,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { FlowAvailableAction } from '@/core/types';
import { FLOW_ACTION_LABELS } from './flowLifecycle';

export function FlowActionsMenu({
  actions,
  isBusy,
  onView,
  onEdit,
  onPublish,
  onClone,
  onDeprecate,
  onDelete,
}: {
  actions: FlowAvailableAction[];
  isBusy?: boolean;
  onView: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onClone: () => void;
  onDeprecate: () => void;
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
        {actions.includes('publish') ? (
          <DropdownMenuItem onClick={onPublish}>
            <Send className="mr-2 h-4 w-4" />
            {FLOW_ACTION_LABELS.publish}
          </DropdownMenuItem>
        ) : null}
        {actions.includes('clone') ? (
          <DropdownMenuItem onClick={onClone}>
            <Copy className="mr-2 h-4 w-4" />
            {FLOW_ACTION_LABELS.clone}
          </DropdownMenuItem>
        ) : null}
        {actions.includes('deprecate') ? (
          <DropdownMenuItem onClick={onDeprecate}>
            <Trash2 className="mr-2 h-4 w-4" />
            {FLOW_ACTION_LABELS.deprecate}
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
