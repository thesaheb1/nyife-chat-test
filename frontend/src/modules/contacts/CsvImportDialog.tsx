import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ContactImportResult, GroupImportResult } from '@/core/types';

export function CsvImportDialog(props: {
  open: boolean;
  contactsResult?: ContactImportResult;
  groupsResult?: GroupImportResult;
  contactsLoading: boolean;
  groupsLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadContactSample: () => Promise<void>;
  onDownloadGroupSample: () => Promise<void>;
  onImportContacts: (file: File) => Promise<ContactImportResult>;
  onImportGroups: (file: File) => Promise<GroupImportResult>;
}) {
  const {
    open,
    contactsResult,
    groupsResult,
    contactsLoading,
    groupsLoading,
    onOpenChange,
    onDownloadContactSample,
    onDownloadGroupSample,
    onImportContacts,
    onImportGroups,
  } = props;
  const [tab, setTab] = useState<'contacts' | 'groups'>('contacts');
  const [contactFile, setContactFile] = useState<File | null>(null);
  const [groupFile, setGroupFile] = useState<File | null>(null);
  const contactInputRef = useRef<HTMLInputElement | null>(null);
  const groupInputRef = useRef<HTMLInputElement | null>(null);

  const normalizeFile = (file: File | undefined) => {
    if (!file) {
      return null;
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB');
      return null;
    }
    return file;
  };

  const handleImportContacts = async () => {
    if (!contactFile) {
      toast.error('Select a contacts CSV first');
      return;
    }
    try {
      const result = await onImportContacts(contactFile);
      toast.success(`Contacts import completed: ${result.created + (result.restored ?? 0)} added or restored`);
      setContactFile(null);
      if (contactInputRef.current) {
        contactInputRef.current.value = '';
      }
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Contacts import failed';
      toast.error(message);
    }
  };

  const handleImportGroups = async () => {
    if (!groupFile) {
      toast.error('Select a groups CSV first');
      return;
    }
    try {
      const result = await onImportGroups(groupFile);
      toast.success(`Groups import completed: ${result.memberships_added} membership(s) added`);
      setGroupFile(null);
      if (groupInputRef.current) {
        groupInputRef.current.value = '';
      }
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Groups import failed';
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] p-0 sm:max-w-5xl">
        <DialogHeader>
          <div className="border-b bg-gradient-to-br from-sky-50 via-background to-emerald-50 px-6 py-5">
            <DialogTitle>CSV Import Center</DialogTitle>
            <DialogDescription>
              Download the sample files first so your contacts and groups match the expected columns exactly.
            </DialogDescription>
          </div>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(value) => setTab(value as 'contacts' | 'groups')} className="space-y-4 px-6 pb-6 pt-2">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="contacts">Contacts CSV</TabsTrigger>
            <TabsTrigger value="groups">Groups CSV</TabsTrigger>
          </TabsList>

          <TabsContent value="contacts">
            <ImportPanel
              title="Import Contacts"
              description="Required: phone. Optional: name, email, company, notes, tags, groups."
              file={contactFile}
              inputRef={contactInputRef}
              loading={contactsLoading}
              result={contactsResult}
              onFileSelected={(file) => setContactFile(normalizeFile(file))}
              onDownloadSample={onDownloadContactSample}
              onImport={handleImportContacts}
            />
          </TabsContent>

          <TabsContent value="groups">
            <ImportPanel
              title="Import Groups"
              description="Required: group_name and contact_phone. One upload can create groups and attach contacts."
              file={groupFile}
              inputRef={groupInputRef}
              loading={groupsLoading}
              result={groupsResult}
              onFileSelected={(file) => setGroupFile(normalizeFile(file))}
              onDownloadSample={onDownloadGroupSample}
              onImport={handleImportGroups}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ImportPanel(props: {
  title: string;
  description: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  loading: boolean;
  result?: ContactImportResult | GroupImportResult;
  onFileSelected: (file: File | undefined) => void;
  onDownloadSample: () => Promise<void>;
  onImport: () => Promise<void>;
}) {
  const { title, description, file, inputRef, loading, result, onFileSelected, onDownloadSample, onImport } = props;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/10 p-8 text-center transition-colors hover:border-primary/40 hover:bg-primary/5" onClick={() => inputRef.current?.click()}>
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">{file ? file.name : 'Click to choose a CSV file'}</p>
            <p className="text-xs text-muted-foreground">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'Maximum 10MB'}</p>
          </div>
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(event) => onFileSelected(event.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await onDownloadSample();
                } catch {
                  toast.error('Failed to download sample CSV');
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Sample
            </Button>
            <Button onClick={onImport} disabled={!file || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Latest Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {result ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(result)
                  .filter(([key]) => key !== 'errors')
                  .map(([key, value]) => (
                    <div key={key} className="rounded-lg border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                      <p className="mt-1 text-2xl font-semibold">{String(value)}</p>
                    </div>
                  ))}
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Errors</p>
                  <ScrollArea className="h-40 rounded-lg border p-3">
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {result.errors.map((error, index) => (
                        <div key={`${error.row}-${error.phone}-${index}`}>
                          Row {error.row ?? '-'}: {error.reason} ({error.phone})
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No import has been run yet in this session.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
