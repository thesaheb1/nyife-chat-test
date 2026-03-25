import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Template } from '@/core/types';
import { WhatsAppTemplatePreview } from './WhatsAppTemplatePreview';

export function TemplatePreviewDialog({
  template,
  open,
  onOpenChange,
  accountName,
  accountPhone,
}: {
  template: Template | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountName?: string | null;
  accountPhone?: string | null;
}) {

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] overflow-y-auto border-none bg-transparent p-0 shadow-none sm:max-w-97.5"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {template?.name || 'Template'} preview
          </DialogTitle>
        </DialogHeader>
        {template ? (
          <WhatsAppTemplatePreview
            templateName={template.name}
            type={template.type}
            components={template.components}
            accountName={accountName}
            accountPhone={accountPhone}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
