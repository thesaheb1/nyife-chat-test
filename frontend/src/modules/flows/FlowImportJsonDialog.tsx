import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export function FlowImportJsonDialog({
  open,
  value,
  isBusy,
  onOpenChange,
  onValueChange,
  onImport,
}: {
  open: boolean;
  value: string;
  isBusy?: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: string) => void;
  onImport: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Meta Flow JSON</DialogTitle>
          <DialogDescription>
            Paste the JSON exported or authored in Meta Flow Builder. Nyife will validate it, normalize it, and keep unsupported structures safely in JSON mode.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          rows={18}
          className="font-mono text-xs"
          placeholder='{"version":"7.1","screens":[...]}'
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onImport} disabled={isBusy}>
            <Upload className="mr-2 h-4 w-4" />
            Import JSON
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
