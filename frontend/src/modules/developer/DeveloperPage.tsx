import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Plus, Copy, Trash2, Loader2, Key } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/shared/components/DataTable';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import type { ApiToken, ApiResponse, PaginationMeta } from '@/core/types';

function useApiTokens(page = 1) {
  return useQuery<{ data: ApiToken[]; meta: PaginationMeta }>({
    queryKey: ['api-tokens', page],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ApiToken[]>>(`${ENDPOINTS.USERS.API_TOKENS}?page=${page}&limit=20`);
      return { data: data.data, meta: data.meta! };
    },
  });
}

export function DeveloperPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useApiTokens(page);
  const [createOpen, setCreateOpen] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [newToken, setNewToken] = useState('');

  const tokens = data?.data ?? [];
  const meta = data?.meta;

  const createToken = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiResponse<ApiToken & { token: string }>>(ENDPOINTS.USERS.API_TOKENS, { name: tokenName });
      return data.data;
    },
    onSuccess: (d) => {
      setNewToken((d as ApiToken & { token: string }).token);
      setTokenName('');
      qc.invalidateQueries({ queryKey: ['api-tokens'] });
    },
    onError: () => toast.error('Failed to create token'),
  });

  const revokeToken = useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`${ENDPOINTS.USERS.API_TOKENS}/${id}`); },
    onSuccess: () => { toast.success('Token revoked'); qc.invalidateQueries({ queryKey: ['api-tokens'] }); },
  });

  const copyToken = () => {
    navigator.clipboard.writeText(newToken);
    toast.success('Token copied to clipboard');
  };

  const columns = useMemo<ColumnDef<ApiToken, unknown>[]>(() => [
    { accessorKey: 'name', header: 'Name', cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span> },
    { accessorKey: 'token_prefix', header: 'Key', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}...</span> },
    {
      accessorKey: 'is_active', header: 'Status',
      cell: ({ getValue }) => <Badge variant="secondary" className={`text-xs ${getValue() ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{getValue() ? 'Active' : 'Revoked'}</Badge>,
    },
    { accessorKey: 'last_used_at', header: 'Last Used', cell: ({ getValue }) => { const v = getValue() as string | null; return v ? new Date(v).toLocaleDateString() : 'Never'; } },
    { accessorKey: 'created_at', header: 'Created', cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString() },
    {
      id: 'actions',
      cell: ({ row }) => row.original.is_active ? (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => revokeToken.mutate(row.original.id)}><Trash2 className="h-3 w-3" /></Button>
      ) : null,
    },
  ], []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('developer.title')}</h1>

      <Tabs defaultValue="tokens">
        <TabsList>
          <TabsTrigger value="tokens">API Tokens</TabsTrigger>
          <TabsTrigger value="docs">API Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="tokens" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setCreateOpen(true); setNewToken(''); }}>
              <Plus className="mr-2 h-4 w-4" />Create Token
            </Button>
          </div>
          <DataTable columns={columns} data={tokens} isLoading={isLoading} page={meta?.page ?? 1} totalPages={meta?.totalPages ?? 1} total={meta?.total} onPageChange={setPage} emptyMessage="No API tokens." />
        </TabsContent>

        <TabsContent value="docs">
          <ApiDocsSection />
        </TabsContent>
      </Tabs>

      {/* Create Token Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{newToken ? 'Token Created' : 'Create API Token'}</DialogTitle></DialogHeader>
          {newToken ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Copy this token now. It won't be shown again.</p>
              <div className="flex items-center gap-2 rounded bg-muted p-3">
                <Key className="h-4 w-4 shrink-0 text-muted-foreground" />
                <code className="flex-1 break-all text-xs">{newToken}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyToken}><Copy className="h-3 w-3" /></Button>
              </div>
              <DialogFooter><Button onClick={() => setCreateOpen(false)}>Done</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Token Name</Label><Input value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="e.g., Production API" /></div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={() => createToken.mutate()} disabled={createToken.isPending || !tokenName.trim()}>
                  {createToken.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- API Documentation Section ---
function ApiDocsSection() {
  const baseUrl = `${window.location.origin}/api/v1`;

  const examples = [
    {
      title: 'Send Text Message',
      endpoint: 'POST /api/v1/whatsapp/send',
      samples: {
        'Node.js': `const axios = require('axios');

const res = await axios.post('${baseUrl}/whatsapp/send', {
  wa_account_id: 'YOUR_WA_ACCOUNT_ID',
  to: '+919876543210',
  type: 'text',
  message: { body: 'Hello from Nyife!' }
}, {
  headers: { 'Authorization': 'Bearer YOUR_API_TOKEN' }
});
console.log(res.data);`,
        Python: `import requests

res = requests.post('${baseUrl}/whatsapp/send', json={
    'wa_account_id': 'YOUR_WA_ACCOUNT_ID',
    'to': '+919876543210',
    'type': 'text',
    'message': {'body': 'Hello from Nyife!'}
}, headers={'Authorization': 'Bearer YOUR_API_TOKEN'})
print(res.json())`,
        PHP: `$ch = curl_init('${baseUrl}/whatsapp/send');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer YOUR_API_TOKEN',
    'Content-Type: application/json'
  ],
  CURLOPT_POSTFIELDS => json_encode([
    'wa_account_id' => 'YOUR_WA_ACCOUNT_ID',
    'to' => '+919876543210',
    'type' => 'text',
    'message' => ['body' => 'Hello from Nyife!']
  ])
]);
$response = curl_exec($ch);`,
        Java: `HttpClient client = HttpClient.newHttpClient();
String json = """
  {"wa_account_id":"YOUR_WA_ACCOUNT_ID","to":"+919876543210","type":"text","message":{"body":"Hello from Nyife!"}}
  """;
HttpRequest request = HttpRequest.newBuilder()
  .uri(URI.create("${baseUrl}/whatsapp/send"))
  .header("Authorization", "Bearer YOUR_API_TOKEN")
  .header("Content-Type", "application/json")
  .POST(HttpRequest.BodyPublishers.ofString(json))
  .build();
HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());`,
        Ruby: `require 'net/http'
require 'json'

uri = URI('${baseUrl}/whatsapp/send')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true
req = Net::HTTP::Post.new(uri)
req['Authorization'] = 'Bearer YOUR_API_TOKEN'
req['Content-Type'] = 'application/json'
req.body = { wa_account_id: 'YOUR_WA_ACCOUNT_ID', to: '+919876543210', type: 'text', message: { body: 'Hello from Nyife!' } }.to_json
res = http.request(req)
puts JSON.parse(res.body)`,
      },
    },
    {
      title: 'Send Template Message',
      endpoint: 'POST /api/v1/whatsapp/send/template',
      samples: {
        'Node.js': `const res = await axios.post('${baseUrl}/whatsapp/send/template', {
  wa_account_id: 'YOUR_WA_ACCOUNT_ID',
  to: '+919876543210',
  template_id: 'YOUR_TEMPLATE_ID',
  variables: { '1': 'John' }
}, {
  headers: { 'Authorization': 'Bearer YOUR_API_TOKEN' }
});`,
        Python: `res = requests.post('${baseUrl}/whatsapp/send/template', json={
    'wa_account_id': 'YOUR_WA_ACCOUNT_ID',
    'to': '+919876543210',
    'template_id': 'YOUR_TEMPLATE_ID',
    'variables': {'1': 'John'}
}, headers={'Authorization': 'Bearer YOUR_API_TOKEN'})`,
      },
    },
  ];

  const [activeLang, setActiveLang] = useState<Record<number, string>>({});

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-lg">Authentication</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm mb-2">Include your API token in the <code className="bg-muted px-1 rounded text-xs">Authorization</code> header:</p>
          <pre className="rounded bg-muted p-3 text-xs overflow-auto">Authorization: Bearer YOUR_API_TOKEN</pre>
        </CardContent>
      </Card>

      {examples.map((ex, idx) => {
        const langs = Object.keys(ex.samples);
        const currentLang = activeLang[idx] || langs[0];
        return (
          <Card key={idx}>
            <CardHeader>
              <CardTitle className="text-lg">{ex.title}</CardTitle>
              <code className="text-xs text-muted-foreground">{ex.endpoint}</code>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1 mb-2">
                {langs.map((lang) => (
                  <Button key={lang} variant={currentLang === lang ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setActiveLang((p) => ({ ...p, [idx]: lang }))}>
                    {lang}
                  </Button>
                ))}
              </div>
              <pre className="rounded bg-muted p-3 text-xs overflow-auto max-h-64">
                {(ex.samples as Record<string, string>)[currentLang]}
              </pre>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
