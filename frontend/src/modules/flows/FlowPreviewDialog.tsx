import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getApiErrorMessage } from '@/core/errors/apiError';
import type { FlowDefinition, WhatsAppFlow } from '@/core/types';
import { cn } from '@/lib/utils';
import { META_FLOW_MANAGER_URL, isFlowPreviewExpired } from './flowPreview';
import { FlowLocalPreviewPane, FlowPreviewNotesCard } from './FlowPreviewPane';

type FlowPreviewTab = 'nyife' | 'meta';

function toOfficialPreviewState(flow?: Pick<WhatsAppFlow, 'meta_flow_id' | 'preview_url' | 'preview_expires_at'> | null) {
  return {
    metaFlowId: flow?.meta_flow_id || null,
    previewUrl: flow?.preview_url || null,
    previewExpiresAt: flow?.preview_expires_at || null,
  };
}

export function FlowPreviewDialog({
  open,
  onOpenChange,
  title,
  definition,
  builderSupported = true,
  warning,
  initialTab = 'nyife',
  metaFlowId,
  previewUrl,
  previewExpiresAt,
  syncOfficialPreviewBeforeOpen = false,
  onEnsureOfficialPreview,
  onRefreshOfficialPreview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  definition: FlowDefinition;
  builderSupported?: boolean;
  warning?: string | null;
  initialTab?: FlowPreviewTab;
  metaFlowId?: string | null;
  previewUrl?: string | null;
  previewExpiresAt?: string | null;
  syncOfficialPreviewBeforeOpen?: boolean;
  onEnsureOfficialPreview?: () => Promise<WhatsAppFlow | null>;
  onRefreshOfficialPreview?: (force?: boolean) => Promise<WhatsAppFlow | null>;
}) {
  const [activeTab, setActiveTab] = useState<FlowPreviewTab>(initialTab);
  const [pending, setPending] = useState(false);
  const [hasAutoPreparedMeta, setHasAutoPreparedMeta] = useState(false);
  const [officialPreview, setOfficialPreview] = useState(() => toOfficialPreviewState({
    meta_flow_id: metaFlowId || null,
    preview_url: previewUrl || null,
    preview_expires_at: previewExpiresAt || null,
  }));

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setHasAutoPreparedMeta(false);
    }
  }, [initialTab, open]);

  useEffect(() => {
    setOfficialPreview(toOfficialPreviewState({
      meta_flow_id: metaFlowId || null,
      preview_url: previewUrl || null,
      preview_expires_at: previewExpiresAt || null,
    }));
  }, [metaFlowId, previewExpiresAt, previewUrl]);

  const officialPreviewExpired = useMemo(
    () => isFlowPreviewExpired(officialPreview.previewExpiresAt),
    [officialPreview.previewExpiresAt]
  );

  const runOfficialPreviewAction = async (mode: 'ensure' | 'refresh', force = false) => {
    if (mode === 'ensure' && !onEnsureOfficialPreview) {
      return null;
    }

    if (mode === 'refresh' && !onRefreshOfficialPreview) {
      return null;
    }

    setPending(true);
    try {
      const flow = mode === 'ensure'
        ? await onEnsureOfficialPreview?.()
        : await onRefreshOfficialPreview?.(force);
      if (flow) {
        setOfficialPreview(toOfficialPreviewState(flow));
      }
      return flow;
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to prepare the official Meta preview.'));
      return null;
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    if (!open || activeTab !== 'meta' || pending) {
      return;
    }

    if (syncOfficialPreviewBeforeOpen && onEnsureOfficialPreview && !hasAutoPreparedMeta) {
      setHasAutoPreparedMeta(true);
      void runOfficialPreviewAction('ensure');
      return;
    }

    if (
      officialPreview.metaFlowId
      && (!officialPreview.previewUrl || officialPreviewExpired)
      && onRefreshOfficialPreview
    ) {
      void runOfficialPreviewAction('refresh', !officialPreview.previewUrl);
    }
  }, [
    activeTab,
    officialPreview.metaFlowId,
    officialPreview.previewUrl,
    officialPreviewExpired,
    onEnsureOfficialPreview,
    onRefreshOfficialPreview,
    open,
    pending,
    hasAutoPreparedMeta,
    syncOfficialPreviewBeforeOpen,
  ]);

  const metaTabReady = Boolean(
    officialPreview.metaFlowId
    || officialPreview.previewUrl
    || onEnsureOfficialPreview
    || onRefreshOfficialPreview
  );

  const openOfficialPreview = () => {
    if (officialPreview.previewUrl) {
      window.open(officialPreview.previewUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!h-[min(100dvh-1rem,62rem)] !w-[min(100vw-1rem,84rem)] !max-w-[min(100vw-1rem,84rem)] !gap-0 !overflow-hidden !border-none !bg-transparent !p-0 !shadow-none sm:!w-[min(100vw-2rem,84rem)] md:!h-[min(100dvh-2rem,62rem)]"
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border bg-background shadow-2xl sm:rounded-[32px]">
          <DialogHeader className="gap-4 border-b px-4 py-4 text-left sm:px-6 sm:py-5">
            <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-lg sm:text-xl">{title}</DialogTitle>
                  <Badge variant="outline">Preview</Badge>
                </div>
                <DialogDescription className="max-w-3xl text-sm">
                  Use Nyife Preview for quick local validation and navigation checks. Use Official Meta Preview for the exact Meta-rendered web preview before publish.
                </DialogDescription>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => window.open(META_FLOW_MANAGER_URL, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Meta Flow Builder
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => void runOfficialPreviewAction(
                    syncOfficialPreviewBeforeOpen ? 'ensure' : 'refresh',
                    true
                  )}
                  disabled={pending || (!onEnsureOfficialPreview && !onRefreshOfficialPreview)}
                >
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                  Refresh official preview
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={openOfficialPreview}
                  disabled={!officialPreview.previewUrl}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open official preview
                </Button>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FlowPreviewTab)} className="flex min-h-0 flex-1 flex-col">
            <div className="border-b px-4 py-3 sm:px-6">
              <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
                <TabsTrigger value="nyife">Nyife Preview</TabsTrigger>
                <TabsTrigger value="meta" disabled={!metaTabReady}>
                  Official Meta Preview
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <TabsContent value="nyife" className="mt-0">
                <div className="mx-auto grid max-w-4xl gap-4">
                  <FlowLocalPreviewPane
                    definition={definition}
                    builderSupported={builderSupported}
                    warning={warning}
                    title="Nyife Preview"
                    description="Fast local preview for supported static flows while you build."
                    className="h-fit"
                    previewClassName="max-w-[360px]"
                  />
                  <FlowPreviewNotesCard className="h-fit" />
                </div>
              </TabsContent>

              <TabsContent value="meta" className="mt-0">
                <div className="mx-auto max-w-5xl space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {officialPreview.metaFlowId ? <Badge variant="outline">Meta linked</Badge> : null}
                    {officialPreview.previewUrl ? (
                      <Badge variant={officialPreviewExpired ? 'secondary' : 'outline'}>
                        {officialPreviewExpired ? 'Preview expired' : 'Preview ready'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Preview pending</Badge>
                    )}
                  </div>

                  {pending ? (
                    <div className="flex min-h-[22rem] items-center justify-center gap-3 rounded-3xl border border-dashed bg-muted/20 px-6 text-sm text-muted-foreground sm:min-h-[26rem]">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Preparing official Meta preview...
                    </div>
                  ) : officialPreview.previewUrl ? (
                    <div className="overflow-hidden rounded-3xl border bg-muted/20">
                      <iframe
                        title={`${title} official Meta preview`}
                        src={officialPreview.previewUrl}
                        className="h-[48vh] min-h-[22rem] w-full bg-white sm:h-[56vh] lg:h-[60vh]"
                      />
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground sm:p-8">
                      {officialPreview.metaFlowId
                        ? 'No official preview URL is available yet. Refresh the preview to ask Meta for a fresh preview link.'
                        : 'This flow is not linked to Meta yet. Open the Official Meta Preview tab after saving a draft so Nyife can prepare the preview for you.'}
                    </div>
                  )}

                  <div
                    className={cn(
                      'rounded-2xl border px-4 py-3 text-sm',
                      officialPreview.previewUrl && !officialPreviewExpired
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-muted-foreground/20 bg-muted/20 text-muted-foreground'
                    )}
                  >
                    {officialPreview.previewUrl && !officialPreviewExpired
                      ? 'A recent Meta preview URL is available. Use the open button above if you want to inspect it in a separate tab.'
                      : 'Official preview links can expire. Refresh the preview when needed so Nyife can fetch the latest Meta preview state.'}
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
