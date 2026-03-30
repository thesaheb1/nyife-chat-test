import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { FlowDefinition } from '@/core/types';
import { cn } from '@/lib/utils';
import { WhatsAppFlowPreview } from './WhatsAppFlowPreview';

export function FlowPreviewNotesCard({
  className,
}: {
  className?: string;
}) {
  return (
    <Card className={cn('rounded-3xl shadow-sm', className)}>
      <CardHeader className="pb-3">
        <CardTitle>Preview notes</CardTitle>
        <CardDescription>
          Nyife Preview is tuned for fast iteration while you build the flow.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>Use this preview to validate required fields, navigation flow, and completion behavior without leaving the builder.</p>
        <p>If the JSON exceeds the supported builder subset, Nyife keeps the Meta definition safe instead of rewriting unsupported structure.</p>
        <p>Use Official Meta Preview before publish whenever you need the exact Meta-rendered experience.</p>
      </CardContent>
    </Card>
  );
}

export function FlowLocalPreviewPane({
  definition,
  builderSupported = true,
  warning,
  title = 'Nyife Preview',
  description = 'Fast local preview for supported static flows while you build.',
  action,
  className,
  previewClassName,
}: {
  definition: FlowDefinition;
  builderSupported?: boolean;
  warning?: string | null;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  previewClassName?: string;
}) {
  return (
    <Card className={cn('rounded-3xl shadow-sm', className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.08),transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-4 sm:p-5">
        <WhatsAppFlowPreview
          definition={definition}
          builderSupported={builderSupported}
          warning={warning}
          className={cn('mx-auto w-full max-w-[360px]', previewClassName)}
        />
      </CardContent>
    </Card>
  );
}

export function FlowPreviewExpandButton({
  onClick,
  label = 'Expand preview',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button type="button" variant="outline" onClick={onClick} className="w-full sm:w-auto">
      {label}
    </Button>
  );
}
