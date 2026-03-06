import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useImportCSV } from './useContacts';

export function ImportCSVPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const importCSV = useImportCSV();
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (!f.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error('File must be under 10MB');
        return;
      }
      setFile(f);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    try {
      await importCSV.mutateAsync(file);
      toast.success('CSV import completed');
    } catch (error) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Import failed';
      toast.error(msg);
    }
  };

  const result = importCSV.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/contacts')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import Contacts</h1>
          <p className="text-sm text-muted-foreground">Upload a CSV file to import contacts in bulk</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload Zone */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Upload CSV</CardTitle>
            <CardDescription>
              Supported columns: phone/mobile/number, name, email, company, notes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary"
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <>
                  <FileSpreadsheet className="mb-2 h-8 w-8 text-primary" />
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </>
              ) : (
                <>
                  <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to select a CSV file</p>
                  <p className="text-xs text-muted-foreground">Max 10MB</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              className="w-full"
              onClick={handleImport}
              disabled={!file || importCSV.isPending}
            >
              {importCSV.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Import Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Total Rows" value={result.total} />
                <Stat label="Created" value={result.created} icon={<CheckCircle className="h-4 w-4 text-green-500" />} />
                <Stat label="Updated" value={result.updated} />
                <Stat label="Skipped" value={result.skipped} icon={result.skipped > 0 ? <AlertCircle className="h-4 w-4 text-yellow-500" /> : undefined} />
              </div>

              {result.errors.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-destructive">
                    Errors ({result.errors.length})
                  </p>
                  <div className="max-h-48 space-y-1 overflow-auto rounded border p-2">
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        {err.row ? `Row ${err.row}` : 'General'}: {err.reason}
                        {err.phone && ` (${err.phone})`}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="outline" className="w-full" onClick={() => navigate('/contacts')}>
                View Contacts
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-2xl font-bold">{value}</p>
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
