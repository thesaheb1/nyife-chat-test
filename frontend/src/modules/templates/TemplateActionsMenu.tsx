import { Eye, Loader2, MoreHorizontal, Pencil, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TEMPLATE_ACTION_LABELS, type TemplateActionKey } from './templateCatalog';

export function TemplateActionsMenu({
  actions,
  isBusy,
  onView,
  onEdit,
  onPublish,
  onDelete,
}: {
  actions: TemplateActionKey[];
  isBusy?: boolean;
  onView: () => void;
  onEdit: () => void;
  onPublish: () => void;
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
          <span className="sr-only">Open template actions</span>
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
            {TEMPLATE_ACTION_LABELS.view}
          </DropdownMenuItem>
        ) : null}
        {actions.includes('edit') ? (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            {TEMPLATE_ACTION_LABELS.edit}
          </DropdownMenuItem>
        ) : null}
        {actions.includes('publish') ? (
          <DropdownMenuItem onClick={onPublish}>
            <Send className="mr-2 h-4 w-4" />
            {TEMPLATE_ACTION_LABELS.publish}
          </DropdownMenuItem>
        ) : null}
        {actions.includes('delete') ? (
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            {TEMPLATE_ACTION_LABELS.delete}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
