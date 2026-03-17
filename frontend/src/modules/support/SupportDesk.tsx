import { type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MoreHorizontal, Plus, Send, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { useSupportThreadSocket } from '@/core/hooks';
import type { SupportTicket } from '@/core/types';
import { buildOrganizationPath } from '@/modules/organizations/context';
import { useOrganizationContext } from '@/modules/organizations/useOrganizationContext';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import {
  useCloseSupportTicket,
  useCreateSupportTicket,
  useMarkSupportTicketRead,
  useRateSupportTicket,
  useReplyToSupportTicket,
  useSupportInfiniteMessages,
  useSupportTickets,
  useSupportThread,
} from './useSupportDesk';

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_on_user: 'Waiting on you',
  resolved: 'Resolved',
  closed: 'Closed',
};

function formatTimestamp(value?: string | null) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleString();
}

function isTerminalTicketStatus(status?: string | null) {
  return status === 'resolved' || status === 'closed';
}

function renderRatingStars(value: number) {
  return Array.from({ length: 5 }, (_, index) => (
    <Star
      key={`user-rating-star-${value}-${index}`}
      className={cn('h-4 w-4', index < value ? 'fill-current text-yellow-500' : 'text-muted-foreground/40')}
    />
  ));
}

function ThreadItem({
  active,
  onOpen,
  onRate,
  ticket,
}: {
  active: boolean;
  onOpen: () => void;
  onRate: () => void;
  ticket: SupportTicket;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className={cn(
        'w-full max-w-full overflow-hidden rounded-xl border px-3 py-3 text-left transition hover:border-primary/40 hover:bg-muted/30',
        'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active ? 'border-primary bg-primary/5' : 'border-border bg-background'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-2 break-words pr-2 text-sm font-semibold [overflow-wrap:anywhere]">
                {ticket.subject}
              </p>
              <p className="truncate text-xs text-muted-foreground">#{ticket.ticket_number}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" data-row-click-ignore="true">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onOpen}>Open ticket</DropdownMenuItem>
                {ticket.can_rate ? <DropdownMenuItem onClick={onRate}>Rate resolved ticket</DropdownMenuItem> : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {ticket.last_message_preview || ticket.description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[11px]">
              {STATUS_LABELS[ticket.status] || ticket.status}
            </Badge>
            <Badge variant="secondary" className="text-[11px] capitalize">
              {ticket.category}
            </Badge>
            <Badge variant="secondary" className="text-[11px]">
              {ticket.message_count || 0} msgs
            </Badge>
            {isTerminalTicketStatus(ticket.status) ? (
              ticket.satisfaction_rating ? (
                <Badge variant="secondary" className="inline-flex items-center gap-1 text-[11px]">
                  <Star className="h-3.5 w-3.5 fill-current text-yellow-500" />
                  {ticket.satisfaction_rating}/5
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px]">
                  Not rated
                </Badge>
              )
            ) : null}
            {ticket.unread_count ? (
              <Badge variant="destructive" className="text-[11px]">
                {ticket.unread_count}
              </Badge>
            ) : null}
            <span className="text-[11px] text-muted-foreground">
              {formatTimestamp(ticket.last_message_at || ticket.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: { id: string; reply_type: string; body: string; created_at: string; sender?: { full_name?: string | null; email?: string | null } | null } }) {
  const isAdmin = message.reply_type === 'admin';

  return (
    <div className={cn('flex w-full', isAdmin ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'w-fit max-w-[88%] break-words rounded-2xl px-4 py-3 shadow-sm [overflow-wrap:anywhere] sm:max-w-[80%]',
          isAdmin ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'
        )}
      >
        <div className="mb-1 flex items-center gap-2 text-[11px] opacity-80">
          <span className="max-w-full truncate">
            {message.sender?.full_name || message.sender?.email || (isAdmin ? 'Support' : 'You')}
          </span>
          <span>{formatTimestamp(message.created_at)}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm">{message.body}</p>
      </div>
    </div>
  );
}

export function SupportDesk() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeOrganization } = useOrganizationContext();
  const organizationId = activeOrganization?.id || null;
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingTicketId, setRatingTicketId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('technical');
  const [priority, setPriority] = useState('medium');
  const hasSplitLayout = useMediaQuery('(min-width: 1024px)');

  const ticketsQuery = useSupportTickets(
    {
      page,
      limit: 20,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: search || undefined,
    },
    organizationId
  );

  const threadQuery = useSupportThread(id, organizationId);
  const messagesQuery = useSupportInfiniteMessages(id, { limit: 30 }, organizationId);
  const createTicket = useCreateSupportTicket(organizationId);
  const replyMutation = useReplyToSupportTicket(id, organizationId);
  const closeMutation = useCloseSupportTicket(id, organizationId);
  const rateMutation = useRateSupportTicket(ratingTicketId || undefined, organizationId);
  const markReadMutation = useMarkSupportTicketRead(id, organizationId);

  useSupportThreadSocket({
    ticketId: id,
    organizationId,
    mode: 'user',
    onIncomingCounterpartyMessage: () => {
      if (!markReadMutation.isPending) {
        markReadMutation.mutate();
      }
    },
  });

  const tickets = ticketsQuery.data?.tickets || [];
  const selectedTicket = threadQuery.data?.ticket || null;
  const loadedPages = messagesQuery.data?.pages || [];
  const messages = id
    ? loadedPages.length > 0
      ? loadedPages
        .slice()
        .reverse()
        .flatMap((pageData) => pageData.messages)
      : threadQuery.data?.messages || []
    : [];
  const threadMeta = messagesQuery.data?.pages?.[0]?.meta || threadQuery.data?.messages_meta;
  const isTerminalTicket = isTerminalTicketStatus(selectedTicket?.status);

  useEffect(() => {
    if (!id) {
      return;
    }

    markReadMutation.mutate();
  }, [id]);

  useEffect(() => {
    if (!hasSplitLayout) {
      return;
    }

    if (!id && tickets.length > 0 && activeOrganization) {
      navigate(buildOrganizationPath(activeOrganization.slug, `/support/${tickets[0].id}`), { replace: true });
    }
  }, [hasSplitLayout, id, tickets, activeOrganization, navigate]);

  const openTicket = (ticketId: string) => {
    if (!activeOrganization) {
      return;
    }

    navigate(buildOrganizationPath(activeOrganization.slug, `/support/${ticketId}`));
  };

  const submitTicket = async () => {
    try {
      const result = await createTicket.mutateAsync({
        subject,
        description,
        category,
        priority,
      });

      toast.success('Support ticket created.');
      setCreateOpen(false);
      setSubject('');
      setDescription('');
      setCategory('technical');
      setPriority('medium');

      if (activeOrganization) {
        navigate(buildOrganizationPath(activeOrganization.slug, `/support/${result.ticket.id}`));
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to create the support ticket.'));
    }
  };

  const sendReply = async () => {
    try {
      await replyMutation.mutateAsync({ body: replyBody });
      setReplyBody('');
      toast.success('Reply sent.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to send the reply.'));
    }
  };

  const closeTicket = async () => {
    try {
      await closeMutation.mutateAsync();
      toast.success('Ticket closed.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to close the ticket.'));
    }
  };

  const submitRating = async () => {
    if (!ratingTicketId || !rating) {
      return;
    }

    try {
      await rateMutation.mutateAsync({
        satisfaction_rating: rating,
        satisfaction_feedback: ratingFeedback || undefined,
      });
      toast.success('Thanks for the rating.');
      setRatingOpen(false);
      setRatingTicketId(null);
      setRating(0);
      setRatingFeedback('');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to submit the rating.'));
    }
  };

  const ratingTarget = useMemo(
    () => tickets.find((ticket) => ticket.id === ratingTicketId) || selectedTicket,
    [tickets, ratingTicketId, selectedTicket]
  );

  return (
    <div className="grid h-[calc(100dvh-8rem)] min-h-[28rem] min-w-0 gap-4 md:h-[calc(100dvh-8.5rem)] lg:h-[calc(100dvh-7.5rem)] lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
      <section
        className={cn(
          'min-h-0 min-w-0 overflow-hidden overscroll-contain flex-col rounded-2xl border bg-background',
          id ? 'hidden lg:flex' : 'flex'
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold">Support Desk</h1>
            <p className="text-sm text-muted-foreground">Track and reply to support threads in realtime.</p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Ticket
          </Button>
        </div>

        <div className="space-y-3 border-b px-4 py-3">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search tickets"
          />
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="waiting_on_user">Waiting on you</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="min-h-0 flex-1 overflow-hidden">
          <div className="px-4 py-4">
            <div className="space-y-3">
              {ticketsQuery.isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-28 rounded-xl" />
                ))
              ) : tickets.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  No support tickets found for this organization.
                </div>
              ) : (
                tickets.map((ticket) => (
                  <ThreadItem
                    key={ticket.id}
                    active={ticket.id === id}
                    ticket={ticket}
                    onOpen={() => openTicket(ticket.id)}
                    onRate={() => {
                      setRatingTicketId(ticket.id);
                      setRatingOpen(true);
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
            Previous
          </Button>
          <span className="text-center text-muted-foreground">
            Page {ticketsQuery.data?.meta?.page || page} of {ticketsQuery.data?.meta?.totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setPage((value) => value + 1)}
            disabled={page >= (ticketsQuery.data?.meta?.totalPages || 1)}
          >
            Next
          </Button>
        </div>
      </section>

      <section
        className={cn(
          'min-h-0 min-w-0 overflow-hidden overscroll-contain flex-col rounded-2xl border bg-background',
          !id || !selectedTicket ? 'hidden lg:flex' : 'flex'
        )}
      >
        {!id || !selectedTicket ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Select a support conversation to open the realtime thread.
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 border-b px-4 py-4 sm:px-5 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-3 lg:hidden">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-0"
                    onClick={() => activeOrganization && navigate(buildOrganizationPath(activeOrganization.slug, '/support'))}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to tickets
                  </Button>
                </div>
                <h2 className="line-clamp-2 break-words text-lg font-semibold [overflow-wrap:anywhere]">
                  {selectedTicket.subject}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>#{selectedTicket.ticket_number}</span>
                  {/* <Badge variant="outline">{STATUS_LABELS[selectedTicket.status] || selectedTicket.status}</Badge> */}
                  <Badge variant="secondary" className="capitalize">{selectedTicket.category}</Badge>
                  <Badge variant="secondary" className="capitalize">{selectedTicket.priority}</Badge>
                  {/* <Badge variant="secondary">{selectedTicket.message_count || messages.length} messages</Badge>
                  <span>Opened {formatTimestamp(selectedTicket.created_at)}</span> */}
                </div>
              </div>
              {!isTerminalTicket ? (
                <Button variant="outline" size="sm" className="w-full md:w-auto" onClick={closeTicket} disabled={closeMutation.isPending}>
                  Close Ticket
                </Button>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-b px-4 py-3 text-sm sm:px-5 md:flex-row md:items-center md:justify-between">
              <span className="text-muted-foreground">
                {messages.length} of {threadMeta?.total || messages.length} messages loaded
              </span>
              <div className="flex w-full items-center gap-2 md:w-auto md:justify-end">
                {messagesQuery.hasNextPage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full md:w-auto"
                    onClick={() => void messagesQuery.fetchNextPage()}
                    disabled={messagesQuery.isFetchingNextPage}
                  >
                    {messagesQuery.isFetchingNextPage ? 'Loading...' : 'Load older messages'}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">All messages loaded</span>
                )}
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1 overflow-hidden">
              <div className="space-y-4 px-4 py-4 sm:px-5">
                {threadQuery.isLoading && messages.length === 0 ? (
                  Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)
                ) : (
                  messages.map((message) => <MessageBubble key={message.id} message={message} />)
                )}
              </div>
            </ScrollArea>

            <Separator />
            {selectedTicket.can_rate ? (
              <div className="flex flex-col gap-3 px-4 py-3 text-sm sm:px-5 md:flex-row md:items-center md:justify-between">
                <span className="text-muted-foreground">This ticket is complete. You can rate the conversation now.</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full md:w-auto"
                  onClick={() => {
                    setRatingTicketId(selectedTicket.id);
                    setRatingOpen(true);
                  }}
                >
                  <Star className="mr-2 h-4 w-4" />
                  Rate chat
                </Button>
              </div>
            ) : null}
            {selectedTicket.satisfaction_rating ? (
              <div className="border-t px-4 py-4 sm:px-5">
                <div className="rounded-2xl border bg-muted/20 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1">{renderRatingStars(selectedTicket.satisfaction_rating)}</div>
                    <span className="text-sm font-medium">{selectedTicket.satisfaction_rating}/5</span>
                    <span className="text-sm text-muted-foreground">Your feedback for this support conversation</span>
                  </div>
                  {selectedTicket.satisfaction_feedback ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                      {selectedTicket.satisfaction_feedback}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {isTerminalTicket ? (
              <div className="border-t px-4 py-4 text-sm text-muted-foreground sm:px-5">
                This ticket is locked for replies. Only support can reopen it.
              </div>
            ) : null}
            {!isTerminalTicket ? (
              <div className="space-y-3 border-t px-4 py-4 sm:px-5">
                <Textarea
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  rows={4}
                  placeholder="Type your message to the support team..."
                />
                <div className="flex justify-end">
                  <Button className="w-full sm:w-auto" onClick={sendReply} disabled={replyMutation.isPending || !replyBody.trim()}>
                    <Send className="mr-2 h-4 w-4" />
                    Send message
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Brief summary" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                placeholder="Describe the issue clearly so the support team can help."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="account">Account</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={submitTicket} disabled={createTicket.isPending || !subject.trim() || !description.trim()}>
              Submit ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ratingOpen} onOpenChange={setRatingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate support chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">{ratingTarget?.subject || 'Resolved ticket'}</p>
              <p className="text-sm text-muted-foreground">Share how the support conversation went.</p>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className={cn('rounded-full p-1', value <= rating ? 'text-yellow-500' : 'text-muted-foreground')}
                >
                  <Star className={cn('h-6 w-6', value <= rating ? 'fill-current' : '')} />
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Feedback</Label>
              <Textarea
                value={ratingFeedback}
                onChange={(event) => setRatingFeedback(event.target.value)}
                rows={4}
                placeholder="Optional feedback"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRatingOpen(false)}>Cancel</Button>
            <Button onClick={submitRating} disabled={rateMutation.isPending || rating < 1}>
              Submit rating
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
