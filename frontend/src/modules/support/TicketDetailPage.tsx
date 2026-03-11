import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Send, Loader2, Star } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { getApiErrorMessage } from '@/core/errors/apiError';
import type { SupportTicket, TicketReply, ApiResponse } from '@/core/types';
import { buildOrganizationPath } from '@/modules/organizations/context';
import { useOrganizationContext } from '@/modules/organizations/useOrganizationContext';

function useTicket(id: string | undefined, organizationId: string) {
  return useQuery<SupportTicket & { replies?: TicketReply[] }>({
    queryKey: ['tickets', organizationId, id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ ticket: SupportTicket & { replies?: TicketReply[] } }>>(`${ENDPOINTS.SUPPORT.TICKETS}/${id}`);
      return data.data.ticket;
    },
    enabled: !!id,
  });
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700', in_progress: 'bg-yellow-100 text-yellow-700',
  waiting_on_user: 'bg-orange-100 text-orange-700', resolved: 'bg-green-100 text-green-700', closed: 'bg-gray-200 text-gray-700',
};

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeOrganization } = useOrganizationContext();
  const organizationId = activeOrganization?.id || 'global';
  const { data: ticket, isLoading } = useTicket(id, organizationId);
  const [replyBody, setReplyBody] = useState('');
  const [rating, setRating] = useState(0);

  const sendReply = useMutation({
    mutationFn: async () => {
      await apiClient.post(`${ENDPOINTS.SUPPORT.TICKETS}/${id}/reply`, { body: replyBody });
    },
    onSuccess: () => {
      toast.success('Reply sent');
      setReplyBody('');
      qc.invalidateQueries({ queryKey: ['tickets', organizationId, id] });
      qc.invalidateQueries({ queryKey: ['tickets', organizationId] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to send the reply.')),
  });

  const closeTicket = useMutation({
    mutationFn: async () => { await apiClient.put(`${ENDPOINTS.SUPPORT.TICKETS}/${id}/close`); },
    onSuccess: () => {
      toast.success('Ticket closed');
      qc.invalidateQueries({ queryKey: ['tickets', organizationId, id] });
      qc.invalidateQueries({ queryKey: ['tickets', organizationId] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to close the ticket.')),
  });

  const rateTicket = useMutation({
    mutationFn: async () => { await apiClient.put(`${ENDPOINTS.SUPPORT.TICKETS}/${id}/rate`, { satisfaction_rating: rating }); },
    onSuccess: () => {
      toast.success('Thanks for your feedback!');
      qc.invalidateQueries({ queryKey: ['tickets', organizationId, id] });
      qc.invalidateQueries({ queryKey: ['tickets', organizationId] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to submit the rating.')),
  });

  if (isLoading) return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48" /></div>;
  if (!ticket) return <div className="py-12 text-center text-muted-foreground">Ticket not found.</div>;

  const replies = ticket.replies ?? [];
  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            navigate(
              activeOrganization
                ? buildOrganizationPath(activeOrganization.slug, '/support')
                : '/support'
            )
          }
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">{ticket.subject}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">#{ticket.ticket_number}</span>
            <Badge className={`${STATUS_COLORS[ticket.status]} text-xs`} variant="secondary">{ticket.status.replace('_', ' ')}</Badge>
            <Badge variant="outline" className="text-xs capitalize">{ticket.category}</Badge>
            <Badge variant="outline" className="text-xs capitalize">{ticket.priority}</Badge>
          </div>
        </div>
        {!isClosed && (
          <Button variant="outline" size="sm" onClick={() => closeTicket.mutate()} disabled={closeTicket.isPending}>
            Close Ticket
          </Button>
        )}
      </div>

      {/* Description */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">Created {new Date(ticket.created_at).toLocaleString()}</p>
        </CardContent>
      </Card>

      {/* Replies */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Conversation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {replies.length === 0 && <p className="text-sm text-muted-foreground">No replies yet.</p>}
          {replies.map((reply) => (
            <div key={reply.id} className={`rounded-lg p-3 ${reply.reply_type === 'admin' ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-muted'}`}>
              <div className="flex items-center justify-between mb-1">
                <Badge variant="outline" className="text-[10px] capitalize">{reply.reply_type}</Badge>
                <span className="text-[10px] text-muted-foreground">{new Date(reply.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
            </div>
          ))}

          {!isClosed && (
            <>
              <Separator />
              <div className="space-y-2">
                <Textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Write a reply..." rows={3} />
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => sendReply.mutate()} disabled={sendReply.isPending || !replyBody.trim()}>
                    {sendReply.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send Reply
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Rating */}
      {isClosed && !ticket.satisfaction_rating && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Rate this ticket</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} className={`${n <= rating ? 'text-yellow-500' : 'text-gray-300'}`}>
                  <Star className="h-6 w-6 fill-current" />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <Button size="sm" onClick={() => rateTicket.mutate()} disabled={rateTicket.isPending}>Submit Rating</Button>
            )}
          </CardContent>
        </Card>
      )}
      {ticket.satisfaction_rating && (
        <Card>
          <CardContent className="pt-4">
            <Label className="text-xs text-muted-foreground">Your Rating</Label>
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={`h-5 w-5 ${n <= ticket.satisfaction_rating! ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
