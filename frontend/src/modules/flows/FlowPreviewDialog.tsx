import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { META_FLOW_MANAGER_URL, isFlowPreviewExpired } from './flowPreview';
import { WhatsAppFlowPreview } from './WhatsAppFlowPreview';

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(92rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>{title}</DialogTitle>
                <Badge variant="outline">Preview</Badge>
              </div>
              <DialogDescription className="max-w-3xl">
                Use Nyife Preview for quick local validation and navigation checks. Use Official Meta Preview for the exact Meta-rendered web preview before sending traffic to the flow.
              </DialogDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.open(META_FLOW_MANAGER_URL, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Meta Flow Builder
              </Button>
              <Button
                type="button"
                variant="outline"
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
                onClick={() => {
                  if (officialPreview.previewUrl) {
                    window.open(officialPreview.previewUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
                disabled={!officialPreview.previewUrl}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open official preview
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FlowPreviewTab)} className="space-y-4">
            <TabsList>
              <TabsTrigger value="nyife">Nyife Preview</TabsTrigger>
              <TabsTrigger value="meta" disabled={!metaTabReady}>
                Official Meta Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="nyife" className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(320px,0.48fr)]">
                <Card className="rounded-3xl shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle>Local authoring preview</CardTitle>
                    <CardDescription>
                      This is the in-app preview for supported static flows. It is fast for iteration, but Meta preview is still the final source of truth.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.08),transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-5">
                    <WhatsAppFlowPreview
                      definition={definition}
                      builderSupported={builderSupported}
                      warning={warning}
                      className="mx-auto max-w-120"
                    />
                  </CardContent>
                </Card>

                <Card className="rounded-3xl shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle>Preview notes</CardTitle>
                    <CardDescription>
                      Nyife Preview is tuned for fast iteration inside the builder.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>Use this tab to verify required fields, navigation flow, and basic completion behavior without leaving Nyife.</p>
                    <p>If the definition exceeds the supported builder subset, Nyife keeps the Meta JSON safe and shows the limitation instead of rewriting unsupported structure.</p>
                    <p>Use the Official Meta Preview tab before publish whenever you need the exact Meta-rendered experience.</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="meta" className="space-y-4">
              <Card className="rounded-3xl shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle>Official Meta Preview</CardTitle>
                      <CardDescription>
                        This tab uses the Meta preview URL stored for the linked flow.
                      </CardDescription>
                    </div>
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
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pending ? (
                    <div className="flex min-h-[26rem] items-center justify-center gap-3 rounded-3xl border border-dashed bg-muted/20 text-sm text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Preparing official Meta preview...
                    </div>
                  ) : officialPreview.previewUrl ? (
                    <div className="overflow-hidden rounded-3xl border bg-muted/20">
                      <iframe
                        title={`${title} official Meta preview`}
                        src={officialPreview.previewUrl}
                        className="h-[70vh] min-h-[34rem] w-full bg-white"
                      />
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-sm text-muted-foreground">
                      {officialPreview.metaFlowId
                        ? 'No official preview URL is available yet. Refresh the preview to ask Meta for a fresh preview link.'
                        : 'This flow is not linked to Meta yet. Open the Official Meta Preview tab after saving a draft so Nyife can prepare the preview for you.'}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
