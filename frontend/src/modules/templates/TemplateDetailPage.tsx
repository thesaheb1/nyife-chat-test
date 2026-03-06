import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Trash2, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useTemplate, useDeleteTemplate, usePublishTemplate } from './useTemplates';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  paused: 'bg-orange-100 text-orange-800',
  disabled: 'bg-gray-300 text-gray-700',
};

export function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: template, isLoading } = useTemplate(id);
  const deleteTemplate = useDeleteTemplate();
  const publishTemplate = usePublishTemplate();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [wabaId, setWabaId] = useState('');

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteTemplate.mutateAsync(id);
      toast.success('Template deleted');
      navigate('/templates');
    } catch {
      toast.error('Failed to delete template');
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    try {
      await publishTemplate.mutateAsync({ id, waba_id: wabaId || undefined });
      toast.success('Template submitted for review');
      setPublishOpen(false);
    } catch (error) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to publish template';
      toast.error(msg);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Template not found.
      </div>
    );
  }

  const components = (template.components || []) as Array<{
    type: string;
    format?: string;
    text?: string;
    buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  }>;

  const canEdit = template.status === 'draft' || template.status === 'rejected';
  const canPublish = template.status === 'draft' || template.status === 'rejected';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/templates')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {template.display_name || template.name}
          </h1>
          <p className="text-sm text-muted-foreground">{template.name}</p>
        </div>
        <div className="flex gap-2">
          {canPublish && (
            <Button variant="outline" size="sm" onClick={() => setPublishOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              Publish
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/templates/${id}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className="mt-1">
                <Badge className={`${STATUS_COLORS[template.status]} text-xs`} variant="secondary">
                  {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Category</Label>
              <p className="mt-1 text-sm font-medium">{template.category}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Type</Label>
              <p className="mt-1 text-sm font-medium capitalize">{template.type.replace('_', ' ')}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Language</Label>
              <p className="mt-1 text-sm font-medium">{template.language}</p>
            </div>
            {template.waba_id && (
              <div>
                <Label className="text-xs text-muted-foreground">WABA ID</Label>
                <p className="mt-1 text-sm font-mono">{template.waba_id}</p>
              </div>
            )}
            {template.meta_template_id && (
              <div>
                <Label className="text-xs text-muted-foreground">Meta Template ID</Label>
                <p className="mt-1 text-sm font-mono">{template.meta_template_id}</p>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Created</Label>
              <p className="mt-1 text-sm">{new Date(template.created_at).toLocaleString()}</p>
            </div>
            {template.last_synced_at && (
              <div>
                <Label className="text-xs text-muted-foreground">Last Synced</Label>
                <p className="mt-1 text-sm">{new Date(template.last_synced_at).toLocaleString()}</p>
              </div>
            )}
          </div>
          {template.rejection_reason && (
            <div className="mt-4 rounded bg-red-50 dark:bg-red-950/30 p-3">
              <Label className="text-xs font-medium text-red-800 dark:text-red-300">Rejection Reason</Label>
              <p className="mt-1 text-sm text-red-700 dark:text-red-400">{template.rejection_reason}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Template Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mx-auto max-w-sm rounded-lg bg-green-50 p-4 dark:bg-green-950/30">
            {components.map((comp, idx) => (
              <div key={idx}>
                {comp.type === 'HEADER' && comp.format === 'TEXT' && comp.text && (
                  <p className="mb-1 font-bold text-sm">{comp.text}</p>
                )}
                {comp.type === 'HEADER' && comp.format && comp.format !== 'TEXT' && (
                  <div className="mb-2 rounded bg-gray-200 dark:bg-gray-700 p-6 text-center text-xs text-muted-foreground">
                    [{comp.format}]
                  </div>
                )}
                {comp.type === 'BODY' && comp.text && (
                  <p className="text-sm whitespace-pre-wrap">{comp.text}</p>
                )}
                {comp.type === 'FOOTER' && comp.text && (
                  <p className="mt-2 text-xs text-muted-foreground">{comp.text}</p>
                )}
                {comp.type === 'BUTTONS' && comp.buttons && comp.buttons.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <Separator />
                    {comp.buttons.map((btn, btnIdx) => (
                      <div
                        key={btnIdx}
                        className="rounded bg-white dark:bg-gray-800 py-1.5 text-center text-sm font-medium text-blue-600 dark:text-blue-400"
                      >
                        {btn.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Components raw view */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Components (JSON)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded bg-muted p-4 text-xs">
            {JSON.stringify(template.components, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* Publish Dialog */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Publish Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Submit this template to Meta for review. Once approved, it can be used in campaigns.
          </p>
          <div className="space-y-2">
            <Label>WABA ID</Label>
            <Input
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              placeholder="WhatsApp Business Account ID"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={publishTemplate.isPending}>
              {publishTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit for Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the template "{template.display_name || template.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
