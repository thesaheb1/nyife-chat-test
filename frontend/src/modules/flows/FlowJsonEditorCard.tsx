import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export function FlowJsonEditorCard({
  jsonDraft,
  isBusy,
  readOnly,
  onChange,
  onReset,
  onApply,
}: {
  jsonDraft: string;
  isBusy?: boolean;
  readOnly?: boolean;
  onChange: (value: string) => void;
  onReset: () => void;
  onApply: () => void;
}) {
  return (
    <Card className="rounded-3xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle>Canonical Meta JSON</CardTitle>
        <CardDescription>
          Paste or edit the exact Meta Flow JSON stored in Nyife. Supported static flows can still round-trip back into the visual builder when the definition stays inside the supported subset.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={jsonDraft}
          onChange={(event) => onChange(event.target.value)}
          rows={28}
          className="min-h-128 font-mono text-xs"
          disabled={readOnly}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onReset} disabled={readOnly}>
            Reset
          </Button>
          <Button type="button" onClick={onApply} disabled={isBusy || readOnly}>
            Apply JSON
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
