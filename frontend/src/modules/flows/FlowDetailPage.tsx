import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, ExternalLink, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/shared/components/DataTable';
import { FlowComponentPreview } from './FlowComponentPreview';
import { humanizeFlowCategory } from './flowUtils';
import { useFlow, useFlowSubmissions } from './useFlows';
import type { FlowSubmission } from '@/core/types';

export function FlowDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: flow, isLoading } = useFlow(id);
  const [submissionPage, setSubmissionPage] = useState(1);
  const { data: submissionsData, isLoading: submissionsLoading } = useFlowSubmissions(id, { page: submissionPage, limit: 10 });

  const columns = useMemo<ColumnDef<FlowSubmission, unknown>[]>(() => [
    {
      accessorKey: 'contact_phone',
      header: 'Contact',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.contact_phone}</p>
          <p className="text-xs text-muted-foreground">{row.original.flow_token || 'No flow token'}</p>
        </div>
      ),
    },
    {
      accessorKey: 'screen_id',
      header: 'Screen',
      cell: ({ row }) => row.original.screen_id || '-',
    },
    {
      accessorKey: 'automation_status',
      header: 'Automation',
      cell: ({ row }) => <Badge variant="outline">{row.original.automation_status}</Badge>,
    },
    {
      accessorKey: 'created_at',
      header: 'Submitted',
      cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
    },
  ], []);

  if (isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Loading flow...</div>;
  }

  if (!flow) {
    return <div className="py-12 text-center text-muted-foreground">Flow not found.</div>;
  }

  const firstScreen = flow.json_definition.screens[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/flows')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{flow.name}</h1>
            <Badge variant="outline">{flow.status}</Badge>
            {flow.has_local_changes && <Badge variant="secondary">Local changes</Badge>}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Inspect the published state, Meta linkage, first-screen preview, validation issues, and real submissions in one place.
          </p>
        </div>
        <div className="flex gap-2">
          {flow.preview_url && (
            <Button variant="outline" asChild>
              <a href={flow.preview_url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Preview URL
              </a>
            </Button>
          )}
          <Button onClick={() => navigate(`/flows/${flow.id}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit flow
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Flow overview</CardTitle>
            <CardDescription>Status, Meta linkage, categories, and validation health.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Metric label="WABA" value={flow.waba_id || 'Not set'} mono />
            <Metric label="Meta flow ID" value={flow.meta_flow_id || 'Not linked'} mono />
            <Metric label="JSON version" value={flow.json_version} />
            <Metric label="Screens" value={String(flow.json_definition.screens.length)} />
            <Metric label="Last synced" value={flow.last_synced_at ? new Date(flow.last_synced_at).toLocaleString() : 'Never'} />
            <Metric label="Categories" value={flow.categories.map(humanizeFlowCategory).join(', ')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>First-screen preview</CardTitle>
            <CardDescription>The first screen is what users usually see first when the flow opens.</CardDescription>
          </CardHeader>
          <CardContent className="bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.08),_transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-6">
            <div className="mx-auto max-w-[360px] rounded-[32px] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60">
              <div className="mx-auto mb-4 h-1.5 w-24 rounded-full bg-slate-200" />
              <div className="space-y-3">
                <div className="rounded-2xl bg-emerald-950 px-4 py-3 text-white">
                  <p className="text-sm font-semibold">{firstScreen.title}</p>
                  <p className="text-xs text-emerald-100">{firstScreen.id}</p>
                </div>
                {firstScreen.layout.children.map((component, index) => (
                  <div key={`${component.type}-${index}`} className="rounded-2xl border border-slate-200 p-4">
                    <FlowComponentPreview component={component} />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="submissions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="submissions">
          <Card>
            <CardHeader>
              <CardTitle>Submissions</CardTitle>
              <CardDescription>Inbound WhatsApp Flow completions captured for this tenant and flow.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={submissionsData?.submissions || []}
                isLoading={submissionsLoading}
                page={submissionsData?.meta.page ?? submissionPage}
                totalPages={submissionsData?.meta.totalPages ?? 1}
                total={submissionsData?.meta.total ?? 0}
                onPageChange={setSubmissionPage}
                emptyMessage="No submissions captured yet."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation">
          <Card>
            <CardHeader>
              <CardTitle>Validation</CardTitle>
              <CardDescription>Local or Meta validation issues stored against this flow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {flow.validation_errors.length === 0 ? (
                <p className="text-muted-foreground">No validation issues recorded.</p>
              ) : (
                flow.validation_errors.map((issue) => <p key={issue}>• {issue}</p>)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json">
          <Card>
            <CardHeader>
              <CardTitle>Flow JSON</CardTitle>
              <CardDescription>The Meta-compatible JSON definition currently stored in Nyife.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(flow.json_definition, null, 2)}</pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={mono ? 'mt-2 break-all font-mono text-sm' : 'mt-2 text-sm font-medium'}>{value}</p>
    </div>
  );
}
