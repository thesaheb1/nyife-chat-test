import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useAdminTicket, useReplyToTicket, useUpdateTicketStatus, useAssignTicket } from './useAdminSupport';
import { toast } from 'sonner';

export function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useAdminTicket(id);
  const replyMut = useReplyToTicket(id ?? '');
  const statusMut = useUpdateTicketStatus(id ?? '');
  const assignMut = useAssignTicket(id ?? '');
  const [replyText, setReplyText] = useState('');
  const [assignTo, setAssignTo] = useState('');

  const handleReply = async () => {
    if (!replyText.trim()) return;
    try {
      await replyMut.mutateAsync(replyText);
      setReplyText('');
      toast.success('Reply sent');
    } catch {
      toast.error('Failed to send reply');
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await statusMut.mutateAsync(status);
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const ticket = data?.ticket;
  const replies = data?.replies ?? [];

  if (!ticket) {
    return <div className="text-muted-foreground">Ticket not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/support')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{ticket.subject}</h1>
          <p className="text-sm text-muted-foreground">#{ticket.ticket_number} — {ticket.category}</p>
        </div>
        <Badge variant={ticket.priority === 'urgent' || ticket.priority === 'high' ? 'destructive' : 'default'}>
          {ticket.priority}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main conversation */}
        <div className="lg:col-span-2 space-y-4">
          {/* Original description */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">User — {new Date(ticket.created_at).toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>

          {/* Replies */}
          {replies.map((reply) => (
            <Card key={reply.id} className={reply.reply_type === 'admin' ? 'border-primary/30' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  <Badge variant={reply.reply_type === 'admin' ? 'default' : 'outline'} className="mr-2">
                    {reply.reply_type}
                  </Badge>
                  {new Date(reply.created_at).toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
              </CardContent>
            </Card>
          ))}

          {/* Reply box */}
          <Card>
            <CardContent className="pt-6">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                rows={4}
              />
              <div className="mt-3 flex justify-end">
                <Button onClick={handleReply} disabled={!replyText.trim() || replyMut.isPending}>
                  <Send className="mr-2 h-4 w-4" />
                  {t('admin.support.reply')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('admin.support.changeStatus')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={ticket.status} onValueChange={handleStatusChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="waiting_on_user">Waiting on User</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('admin.support.assignTo')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Admin user ID"
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  className="text-xs"
                />
                <Button
                  size="sm"
                  disabled={!assignTo.trim() || assignMut.isPending}
                  onClick={async () => {
                    try {
                      await assignMut.mutateAsync(assignTo);
                      toast.success('Ticket assigned');
                      setAssignTo('');
                    } catch {
                      toast.error('Failed to assign ticket');
                    }
                  }}
                >
                  {t('admin.support.assign')}
                </Button>
              </div>
              {ticket.assigned_to && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Currently assigned to: <span className="font-mono">{ticket.assigned_to}</span>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('admin.support.userInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">User ID</span>
                <span className="font-mono text-xs">{ticket.user_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
              </div>
              {ticket.satisfaction_rating && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rating</span>
                  <span>{ticket.satisfaction_rating}/5</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
