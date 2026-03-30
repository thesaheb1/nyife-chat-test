import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ExternalLink, Loader2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { createFlowDefinition, deriveBuilderStateFromMetaFlow } from './flowUtils';
import {
  buildFlowWorkspacePath,
  isFlowPreviewExpired,
  META_FLOW_MANAGER_URL,
  readFlowPreviewSnapshot,
} from './flowPreview';
import { useFlow, useRefreshFlowPreview } from './useFlows';
import { WhatsAppFlowPreview } from './WhatsAppFlowPreview';

function resolvePreviewSource(pathname: string): 'create' | 'edit' | 'detail' {
  if (pathname.endsWith('/flows/create/preview')) {
    return 'create';
  }

  if (pathname.includes('/edit/preview')) {
    return 'edit';
  }

  return 'detail';
}

export function FlowPreviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const previewSource = resolvePreviewSource(location.pathname);
  const snapshot = useMemo(
    () => (
      previewSource === 'detail'
        ? null
        : readFlowPreviewSnapshot({ source: previewSource, flowId: id || null })
    ),
    [id, previewSource]
  );
  const { data: flow, isLoading } = useFlow(id);
  const refreshPreview = useRefreshFlowPreview();
  const [activeTab, setActiveTab] = useState<'nyife' | 'meta'>('nyife');

  const previewName = snapshot?.name || flow?.name || 'Flow preview';
  const previewJson = snapshot?.json_definition || flow?.json_definition || createFlowDefinition('Flow preview');
  const metaFlowId = flow?.meta_flow_id || snapshot?.meta_flow_id || null;
  const previewUrl = flow?.preview_url || snapshot?.preview_url || null;
  const previewExpiresAt = flow?.preview_expires_at || snapshot?.preview_expires_at || null;
  const officialPreviewExpired = isFlowPreviewExpired(previewExpiresAt);
  const builderState = useMemo(
    () => deriveBuilderStateFromMetaFlow(previewJson),
    [previewJson]
  );
  const backPath = buildFlowWorkspacePath({
    source: previewSource,
    flowId: id || null,
  });

  const refreshOfficialPreview = useCallback(async (force = false) => {
    if (!id) {
      return;
    }

    try {
      await refreshPreview.mutateAsync({ id, force });
      toast.success('Official Meta preview refreshed.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to refresh official preview.'));
    }
  }, [id, refreshPreview]);

  useEffect(() => {
    if (
      activeTab === 'meta'
      && id
      && metaFlowId
      && (!previewUrl || officialPreviewExpired)
      && !refreshPreview.isPending
    ) {
      void refreshOfficialPreview(!previewUrl);
    }
  }, [activeTab, id, metaFlowId, officialPreviewExpired, previewUrl, refreshOfficialPreview, refreshPreview.isPending]);

  if (id && isLoading && !flow) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading preview...
      </div>
    );
  }

  if (previewSource === 'create' && !snapshot) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/flows/create')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to builder
        </Button>
        <Card className="rounded-3xl shadow-sm">
          <CardHeader>
            <CardTitle>No draft preview found</CardTitle>
            <CardDescription>
              Open the preview from the flow builder so Nyife can carry the current unsaved draft into this workspace.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-3xl border bg-background p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(backPath)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{previewName}</h1>
                <Badge variant="outline">Preview workspace</Badge>
                {snapshot ? <Badge variant="secondary">Unsaved draft snapshot</Badge> : null}
                {metaFlowId ? <Badge variant="secondary">Meta linked</Badge> : null}
              </div>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Use Nyife Preview for fast local authoring checks. Use Official Meta Preview for the exact web preview before publish.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.open(META_FLOW_MANAGER_URL, '_blank', 'noopener,noreferrer')}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Meta Flow Builder
            </Button>
            <Button
              variant="outline"
              onClick={() => void refreshOfficialPreview(true)}
              disabled={!id || !metaFlowId || refreshPreview.isPending}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh official preview
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (previewUrl) {
                  window.open(previewUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              disabled={!previewUrl}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open official preview
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'nyife' | 'meta')} className="space-y-4">
        <TabsList>
          <TabsTrigger value="nyife">Nyife Preview</TabsTrigger>
          <TabsTrigger value="meta" disabled={!metaFlowId && !previewUrl}>
            Official Meta Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nyife">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.88fr)_minmax(320px,0.52fr)]">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle>Local authoring preview</CardTitle>
                <CardDescription>
                  Fast feedback for supported static flows. This helps while building, but Meta web preview still remains the exact source of truth.
                </CardDescription>
              </CardHeader>
              <CardContent className="bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.08),transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-5">
                <WhatsAppFlowPreview
                  definition={builderState.definition}
                  builderSupported={builderState.supported}
                  warning={builderState.warning}
                  className="mx-auto max-w-116"
                />
              </CardContent>
            </Card>

            <Card className="rounded-3xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle>Preview notes</CardTitle>
                <CardDescription>
                  What this preview can and cannot guarantee before you publish.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Nyife Preview simulates supported field validation, navigation, and form completion locally so you can iterate quickly without leaving the builder.
                </p>
                <p>
                  If this flow uses unsupported Meta JSON features, Nyife keeps the JSON safe and shows the limitation instead of rewriting the structure.
                </p>
                <p>
                  Official Meta Preview is the final checkpoint for exact rendering, since Meta can still render the end-user experience differently from any local simulation.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="meta">
          <Card className="rounded-3xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle>Official Meta Preview</CardTitle>
              <CardDescription>
                This is the exact preview source for publish verification. Nyife refreshes expired preview URLs through the Flow Preview API when possible.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!metaFlowId ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  Save this flow to Meta first to unlock the official preview tab and preview URL.
                </div>
              ) : previewUrl ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant={officialPreviewExpired ? 'secondary' : 'outline'}>
                      {officialPreviewExpired ? 'Preview refreshed or expiring' : 'Preview ready'}
                    </Badge>
                    <span>
                      Expires:{' '}
                      {previewExpiresAt ? new Date(previewExpiresAt).toLocaleString() : 'Unknown'}
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-3xl border bg-muted/20">
                    <iframe
                      title="Official Meta flow preview"
                      src={previewUrl}
                      className="h-[78vh] min-h-160 w-full bg-white"
                    />
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  {refreshPreview.isPending
                    ? 'Refreshing the official preview URL from Meta...'
                    : 'The flow is linked to Meta, but no preview URL is currently available. Refresh the official preview to fetch a fresh URL.'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
