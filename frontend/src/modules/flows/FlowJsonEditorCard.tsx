import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export function FlowJsonEditorCard({
  jsonDraft,
  isBusy,
  onChange,
  onReset,
  onApply,
  onOpenImport,
}: {
  jsonDraft: string;
  isBusy?: boolean;
  onChange: (value: string) => void;
  onReset: () => void;
  onApply: () => void;
  onOpenImport: () => void;
}) {
  return (
    <Card className="rounded-3xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Canonical Meta JSON</CardTitle>
            <CardDescription>
              Edit the exact Flow JSON stored in Nyife. Supported static flows can still round-trip back into the visual builder.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={onOpenImport}>
            <Upload className="mr-2 h-4 w-4" />
            Import JSON
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={jsonDraft}
          onChange={(event) => onChange(event.target.value)}
          rows={28}
          className="min-h-128 font-mono text-xs"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onReset}>
            Reset
          </Button>
          <Button type="button" onClick={onApply} disabled={isBusy}>
            Apply JSON
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
