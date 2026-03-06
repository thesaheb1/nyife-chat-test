import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/core/api/client';
import { toast } from 'sonner';

export function EmailManagementPage() {
  const { t } = useTranslation();
  const [type, setType] = useState<'transactional' | 'marketing'>('transactional');
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!recipients.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      await apiClient.post('/api/v1/admin/email/send', {
        type,
        recipients: recipients.split(',').map((s) => s.trim()).filter(Boolean),
        subject,
        body,
      });
      toast.success('Email sent successfully');
      setSubject('');
      setBody('');
      setRecipients('');
    } catch {
      toast.error('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('admin.email.title')}</h1>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t('admin.email.sendEmail')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'transactional' | 'marketing')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="transactional">Transactional</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('admin.email.recipients')}</Label>
            <Input
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="user1@example.com, user2@example.com"
            />
            <p className="text-xs text-muted-foreground">Comma-separated email addresses</p>
          </div>
          <div className="space-y-2">
            <Label>{t('admin.email.subject')}</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('admin.email.body')}</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="HTML or plain text email body..."
            />
          </div>
          <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}>
            <Send className="mr-2 h-4 w-4" />
            {sending ? 'Sending...' : t('admin.email.sendEmail')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
