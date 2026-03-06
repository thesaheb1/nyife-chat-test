import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminNotifications, useSendNotification } from './useAdminNotifications';
import { toast } from 'sonner';

export function AdminNotificationsPage() {
  const { t } = useTranslation();
  const { data: notifications = [], isLoading } = useAdminNotifications();
  const sendNotification = useSendNotification();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'specific_users'>('all');
  const [targetIds, setTargetIds] = useState('');
  const [sendEmail, setSendEmail] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    try {
      await sendNotification.mutateAsync({
        title,
        body,
        target_type: targetType,
        target_user_ids: targetType === 'specific_users' ? targetIds.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        send_email: sendEmail,
      });
      toast.success('Notification sent');
      setShowCreate(false);
      setTitle('');
      setBody('');
      setTargetIds('');
    } catch {
      toast.error('Failed to send notification');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('admin.notifications.title')}</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.notifications.send')}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : !notifications.length ? (
        <p className="text-muted-foreground">{t('admin.notifications.noNotifications')}</p>
      ) : (
        <div className="space-y-4">
          {notifications.map((notif) => (
            <Card key={notif.id}>
              <CardHeader className="flex flex-row items-start justify-between py-3">
                <div className="flex items-start gap-3">
                  <Bell className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">{notif.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{notif.body}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline">{notif.target_type === 'all' ? 'All Users' : 'Specific'}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Sent to {notif.sent_count} users
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <span className="text-xs text-muted-foreground">
                  {new Date(notif.created_at).toLocaleString()}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Send Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.notifications.send')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('admin.notifications.notificationTitle')}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.notifications.body')}</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.notifications.targetType')}</Label>
              <Select value={targetType} onValueChange={(v) => setTargetType(v as 'all' | 'specific_users')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.notifications.allUsers')}</SelectItem>
                  <SelectItem value="specific_users">{t('admin.notifications.specificUsers')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {targetType === 'specific_users' && (
              <div className="space-y-2">
                <Label>User IDs (comma-separated)</Label>
                <Input value={targetIds} onChange={(e) => setTargetIds(e.target.value)} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
              <Label>{t('admin.notifications.sendEmail')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSend} disabled={!title.trim() || !body.trim() || sendNotification.isPending}>
              {sendNotification.isPending ? 'Sending...' : t('common.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
