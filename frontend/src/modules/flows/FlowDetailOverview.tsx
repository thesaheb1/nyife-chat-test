import { CalendarClock, ExternalLink, Eye, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { WhatsAppFlow } from '@/core/types';
import { META_FLOW_MANAGER_URL } from './flowPreview';
import { humanizeFlowCategory } from './flowUtils';

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border bg-muted/15 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={mono ? 'mt-2 break-all font-mono text-sm' : 'mt-2 text-sm font-medium'}>{value}</p>
    </div>
  );
}

export function FlowDetailOverview({
  flow,
  previewExpired,
  isRefreshingPreview,
  onOpenPreview,
  onRefreshOfficialPreview,
}: {
  flow: WhatsAppFlow;
  previewExpired: boolean;
  isRefreshingPreview?: boolean;
  onOpenPreview: () => void;
  onRefreshOfficialPreview: () => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <Card className="rounded-3xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Flow overview</CardTitle>
          <CardDescription>
            Status, Meta linkage, categories, sync state, and lifecycle readiness at a glance.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Metric label="Meta flow ID" value={flow.meta_flow_id || 'Not linked'} mono />
          <Metric label="JSON version" value={flow.json_version} />
          <Metric label="Screens" value={String(flow.json_definition.screens.length)} />
          <Metric
            label="Last synced"
            value={flow.last_synced_at ? new Date(flow.last_synced_at).toLocaleString() : 'Never'}
          />
          <Metric label="Categories" value={flow.categories.map(humanizeFlowCategory).join(', ')} />
          <Metric
            label="Sendability"
            value={
              flow.can_send_message === false
                ? 'Blocked'
                : flow.can_send_message === true
                  ? 'Allowed'
                  : 'Unknown'
            }
          />
        </CardContent>
      </Card>

      <Card className="rounded-3xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>Preview access</CardTitle>
          <CardDescription>
            Open the reusable preview dialog for Nyife Preview and Official Meta Preview.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onOpenPreview}>
              <Eye className="mr-2 h-4 w-4" />
              Open preview
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onRefreshOfficialPreview}
              disabled={!flow.meta_flow_id || isRefreshingPreview}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh preview
            </Button>
            <Button type="button" variant="ghost" asChild>
              <a href={META_FLOW_MANAGER_URL} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Meta Flow Builder
              </a>
            </Button>
          </div>

          <div className="rounded-2xl border bg-muted/15 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Official preview status</span>
              {flow.preview_url ? (
                <Badge variant={previewExpired ? 'secondary' : 'outline'}>
                  {previewExpired ? 'Expired' : 'Ready'}
                </Badge>
              ) : (
                <Badge variant="secondary">Not available yet</Badge>
              )}
            </div>
            <p className="mt-2 text-muted-foreground">
              {flow.preview_url
                ? previewExpired
                  ? 'The saved Meta preview link looks stale. Refresh it before relying on the official preview tab.'
                  : 'A recent Meta preview URL is available for this flow.'
                : 'Link the flow to Meta first to generate an official preview URL.'}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              <span>
                Expires:{' '}
                {flow.preview_expires_at
                  ? new Date(flow.preview_expires_at).toLocaleString()
                  : 'Unknown'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
