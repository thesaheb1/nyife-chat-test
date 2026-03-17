import { type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MoreHorizontal, RotateCcw, Send, Star, Trash2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { SupportActorSummary, SupportTicket } from '@/core/types';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { useSupportThreadSocket } from '@/core/hooks';
import { apiClient } from '@/core/api/client';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { ADMIN_ENDPOINTS } from '../api';
import {
  type AssignableAdmin,
  useAdminTicket,
  useAdminTicketInfiniteMessages,
  useAdminTickets,
  useAssignTicket,
  useAssignableAdmins,
  useDeleteTicket,
  useMarkAdminTicketRead,
  useReplyToTicket,
  useUpdateTicketStatus,
} from './useAdminSupport';

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_on_user', label: 'Waiting on user' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
] as const;

function formatTimestamp(value?: string | null) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleString();
}

function initials(person?: SupportActorSummary | null) {
  return `${person?.first_name?.[0] || ''}${person?.last_name?.[0] || ''}`.toUpperCase() || 'NA';
}

function isTerminalTicketStatus(status?: string | null) {
  return status === 'resolved' || status === 'closed';
}

function renderRatingStars(value: number) {
  return Array.from({ length: 5 }, (_, index) => (
    <Star
      key={`rating-star-${value}-${index}`}
      className={cn('h-4 w-4', index < value ? 'fill-current text-yellow-500' : 'text-muted-foreground/40')}
    />
  ));
}

function buildUserDetailPath(ticket: SupportTicket) {
  const params = new URLSearchParams();
  const organizationId = ticket.organization?.id || ticket.organization_id;

  params.set('tab', 'support');
  if (organizationId) {
    params.set('organization_id', organizationId);
  }

  return `/admin/users/${ticket.user_id}?${params.toString()}`;
}

function AdminTicketRow({
  active,
  admins,
  onAssign,
  onDelete,
  onOpen,
  onStatusChange,
  ticket,
}: {
  active: boolean;
  admins: Array<AssignableAdmin & { id: string; full_name: string }>;
  onAssign: (ticketId: string, userId: string) => void;
  onDelete: (ticketId: string) => void;
  onOpen: (ticketId: string) => void;
  onStatusChange: (ticketId: string, status: string) => void;
  ticket: SupportTicket;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(ticket.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(ticket.id)}
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
              <p className="truncate text-xs text-muted-foreground">
                #{ticket.ticket_number} {ticket.user?.full_name ? `• ${ticket.user.full_name}` : ''}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpen(ticket.id)}>Open ticket</DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Assign ticket</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {admins.length === 0 ? (
                      <DropdownMenuItem disabled>No sub-admins available</DropdownMenuItem>
                    ) : (
                      admins.map((admin) => (
                        <DropdownMenuItem key={admin.id} onClick={() => onAssign(ticket.id, admin.id)}>
                          {admin.full_name || admin.email || admin.id}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Update status</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {STATUS_OPTIONS.map((status) => (
                      <DropdownMenuItem key={status.value} onClick={() => onStatusChange(ticket.id, status.value)}>
                        {status.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem className="text-destructive" onClick={() => onDelete(ticket.id)}>
                  Delete ticket
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {ticket.last_message_preview || ticket.description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{STATUS_OPTIONS.find((option) => option.value === ticket.status)?.label || ticket.status}</Badge>
            <Badge variant="secondary">{ticket.message_count || 0} msgs</Badge>
            {isTerminalTicketStatus(ticket.status) ? (
              ticket.satisfaction_rating ? (
                <Badge variant="secondary" className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-current text-yellow-500" />
                  {ticket.satisfaction_rating}/5
                </Badge>
              ) : (
                <Badge variant="outline">Not rated</Badge>
              )
            ) : null}
            {ticket.unread_count ? <Badge variant="destructive">{ticket.unread_count}</Badge> : null}
            {ticket.assigned_admin?.full_name ? (
              <Badge variant="secondary">Assigned to {ticket.assigned_admin.full_name}</Badge>
            ) : null}
            <span className="text-[11px] text-muted-foreground">{formatTimestamp(ticket.last_message_at || ticket.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminSupportDesk() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const hasSplitLayout = useMediaQuery('(min-width: 1024px)');

  const ticketsQuery = useAdminTickets({
    page,
    limit: 20,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: search || undefined,
  });
  const ticketQuery = useAdminTicket(id);
  const messagesQuery = useAdminTicketInfiniteMessages(id, { limit: 30 });
  const replyMutation = useReplyToTicket(id);
  const statusMutation = useUpdateTicketStatus(id);
  const deleteMutation = useDeleteTicket(id);
  const assignMutation = useAssignTicket(id);
  const markReadMutation = useMarkAdminTicketRead(id);
  const assignableAdminsQuery = useAssignableAdmins();

  useSupportThreadSocket({
    ticketId: id,
    mode: 'admin',
    onIncomingCounterpartyMessage: () => {
      if (!markReadMutation.isPending) {
        markReadMutation.mutate();
      }
    },
  });

  const tickets = ticketsQuery.data?.tickets || [];
  const selectedTicket = ticketQuery.data?.ticket || null;
  const loadedPages = messagesQuery.data?.pages || [];
  const messages = id
    ? loadedPages.length > 0
      ? loadedPages
        .slice()
        .reverse()
        .flatMap((pageData) => pageData.messages)
      : ticketQuery.data?.messages || []
    : [];
  const assignableAdmins = useMemo(
    () =>
      (assignableAdminsQuery.data || []).map((admin) => ({
        ...admin,
        id: admin.user_id,
        full_name: [admin.first_name, admin.last_name].filter(Boolean).join(' ').trim() || admin.email || admin.user_id,
      })),
    [assignableAdminsQuery.data]
  );
  const isTerminalTicket = isTerminalTicketStatus(selectedTicket?.status);

  useEffect(() => {
    if (!hasSplitLayout) {
      return;
    }

    if (!id && tickets.length > 0) {
      navigate(`/admin/support/${tickets[0].id}`, { replace: true });
    }
  }, [hasSplitLayout, id, tickets, navigate]);

  useEffect(() => {
    if (!id) {
      return;
    }

    markReadMutation.mutate();
  }, [id]);

  const openTicket = (ticketId: string) => navigate(`/admin/support/${ticketId}`);

  const handleStatusChange = async (status: string, targetTicketId = id) => {
    try {
      if (!targetTicketId) {
        return;
      }

      if (targetTicketId !== id) {
        await apiClient.put(ADMIN_ENDPOINTS.SUPPORT.TICKET_STATUS(targetTicketId), { status });
      } else {
        await statusMutation.mutateAsync(status);
      }
      toast.success('Ticket status updated.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update ticket status.'));
    }
  };

  const handleAssign = async (ticketId: string, adminUserId: string) => {
    try {
      if (ticketId !== id || !id) {
        await apiClient.put(ADMIN_ENDPOINTS.SUPPORT.TICKET_ASSIGN(ticketId), {
          admin_user_id: adminUserId,
        });
      } else {
        await assignMutation.mutateAsync(adminUserId);
      }
      toast.success('Ticket assigned.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to assign the ticket.'));
    }
  };

  const handleDelete = async (ticketId = id) => {
    if (!ticketId) {
      return;
    }

    try {
      if (ticketId !== id || !id) {
        await apiClient.delete(ADMIN_ENDPOINTS.SUPPORT.TICKET_DELETE(ticketId));
      } else {
        await deleteMutation.mutateAsync();
        navigate('/admin/support');
      }
      toast.success('Ticket deleted.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete the ticket.'));
    }
  };

  const handleReply = async () => {
    try {
      await replyMutation.mutateAsync(replyText);
      setReplyText('');
      toast.success('Reply sent.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to send the reply.'));
    }
  };

  const reopenTicket = async () => {
    await handleStatusChange('open');
  };

  const openUserDetail = (ticket: SupportTicket) => {
    if (!ticket.user_id) {
      return;
    }

    navigate(buildUserDetailPath(ticket));
  };

  return (
    <div className="grid h-[calc(100dvh-8rem)] min-h-[28rem] min-w-0 gap-4 md:h-[calc(100dvh-8.5rem)] lg:h-[calc(100dvh-7.5rem)] lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
      <section
        className={cn(
          'min-h-0 min-w-0 overflow-hidden overscroll-contain flex-col rounded-2xl border bg-background',
          id ? 'hidden lg:flex' : 'flex'
        )}
      >
        <div className="border-b px-4 py-4">
          <h1 className="text-lg font-semibold">Support Desk</h1>
          <p className="text-sm text-muted-foreground">Manage support threads in realtime and assign them to sub-admins.</p>
        </div>

        <div className="space-y-3 border-b px-4 py-3">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search tickets or users"
          />
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="min-h-0 flex-1 overflow-hidden">
          <div className="space-y-3 px-4 py-4">
            {ticketsQuery.isLoading ? (
              Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)
            ) : tickets.length === 0 ? (
              <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                No support tickets match these filters.
              </div>
            ) : (
              tickets.map((ticket) => (
                <AdminTicketRow
                  key={ticket.id}
                  active={ticket.id === id}
                  admins={assignableAdmins}
                  ticket={ticket}
                  onOpen={openTicket}
                  onAssign={handleAssign}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              ))
            )}
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
            Open a ticket from the queue to manage the live conversation.
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 border-b px-4 py-4 sm:px-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-3 lg:hidden">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-0"
                    onClick={() => navigate('/admin/support')}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to queue
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{initials(selectedTicket.user)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h2 className="line-clamp-2 break-words text-lg font-semibold [overflow-wrap:anywhere]">
                      {selectedTicket.subject}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto min-w-0 justify-start p-0 text-left text-sm font-medium text-foreground"
                        onClick={() => openUserDetail(selectedTicket)}
                      >
                        {selectedTicket.user?.full_name || selectedTicket.user?.email || selectedTicket.user_id}
                      </Button>
                      <span className="hidden sm:inline">•</span>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto min-w-0 justify-start p-0 text-left text-sm font-medium text-foreground"
                        onClick={() => openUserDetail(selectedTicket)}
                      >
                        {selectedTicket.organization?.name || selectedTicket.organization_id}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>#{selectedTicket.ticket_number}</span>
                  {/* <Badge variant="outline">
                    {STATUS_OPTIONS.find((option) => option.value === selectedTicket.status)?.label || selectedTicket.status}
                  </Badge> */}
                  <Badge variant="secondary" className="capitalize">{selectedTicket.category}</Badge>
                  <Badge variant="secondary" className="capitalize">{selectedTicket.priority}</Badge>
                  {/* <Badge variant="secondary">{selectedTicket.message_count || messages.length} messages</Badge>
                  <span>{formatTimestamp(selectedTicket.created_at)}</span> */}
                </div>
                {/* <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <div className="rounded-xl border bg-muted/30 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">User</p>
                    <p className="font-medium text-foreground">
                      {selectedTicket.user?.full_name || selectedTicket.user?.email || selectedTicket.user_id}
                    </p>
                    {selectedTicket.user?.email ? <p>{selectedTicket.user.email}</p> : null}
                    {selectedTicket.user?.phone ? <p>{selectedTicket.user.phone}</p> : null}
                  </div>
                  <div className="rounded-xl border bg-muted/30 px-3 py-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Organization</p>
                    <p className="font-medium text-foreground">
                      {selectedTicket.organization?.name || selectedTicket.organization_id}
                    </p>
                    {selectedTicket.organization?.slug ? <p>{selectedTicket.organization.slug}</p> : null}
                    {selectedTicket.organization?.status ? <p className="capitalize">{selectedTicket.organization.status}</p> : null}
                  </div>
                </div> */}
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto xl:flex-wrap xl:justify-end">
                <Select
                  value={selectedTicket.assigned_to || 'unassigned'}
                  onValueChange={(value) => {
                    if (value !== 'unassigned') {
                      void handleAssign(selectedTicket.id, value);
                    }
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder="Assign to sub-admin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem disabled value="unassigned">Assign to sub-admin</SelectItem>
                    {assignableAdmins.map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.full_name || admin.email || admin.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isTerminalTicket ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => void reopenTicket()}
                    disabled={statusMutation.isPending}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reopen ticket
                  </Button>
                ) : (
                  <Select value={selectedTicket.status} onValueChange={(value) => void handleStatusChange(value)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button variant="destructive" size="sm" className="w-full sm:w-auto" onClick={() => void handleDelete(selectedTicket.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-b px-4 py-3 text-sm sm:px-5 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                {selectedTicket.assigned_admin ? (
                  <span className="inline-flex items-center gap-1">
                    <UserCheck className="h-4 w-4" />
                    Assigned to {selectedTicket.assigned_admin.full_name || selectedTicket.assigned_admin.email}
                  </span>
                ) : (
                  <span>Unassigned</span>
                )}
              </div>
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

            {isTerminalTicket ? (
              <div className="border-b px-4 py-4 sm:px-5">
                <div className="rounded-xl border bg-muted/30 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer rating</p>
                  {selectedTicket.satisfaction_rating ? (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {renderRatingStars(selectedTicket.satisfaction_rating)}
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {selectedTicket.satisfaction_rating}/5
                        </span>
                      </div>
                      {selectedTicket.satisfaction_feedback ? (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {selectedTicket.satisfaction_feedback}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Awaiting customer rating.</p>
                  )}
                </div>
              </div>
            ) : null}

            <ScrollArea className="min-h-0 flex-1 overflow-hidden">
              <div className="space-y-4 px-4 py-4 sm:px-5">
                {ticketQuery.isLoading && messages.length === 0 ? (
                  Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className={cn('flex w-full', message.reply_type === 'admin' ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'w-fit max-w-[88%] break-words rounded-2xl px-4 py-3 shadow-sm [overflow-wrap:anywhere] sm:max-w-[80%]',
                          message.reply_type === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                        )}
                      >
                        <div className="mb-1 flex items-center gap-2 text-[11px] opacity-80">
                          <span className="max-w-full truncate">
                            {message.sender?.full_name || message.sender?.email || message.reply_type}
                          </span>
                          <span>{formatTimestamp(message.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <Separator />
            {isTerminalTicket ? (
              <div className="border-t px-4 py-4 text-sm text-muted-foreground sm:px-5">
                This ticket is locked for replies. Reopen it to continue the conversation.
              </div>
            ) : null}
            {!isTerminalTicket ? (
              <div className="space-y-3 border-t px-4 py-4 sm:px-5">
                <Textarea
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  rows={4}
                  placeholder="Reply to the customer..."
                />
                <div className="flex justify-end">
                  <Button className="w-full sm:w-auto" onClick={handleReply} disabled={replyMutation.isPending || !replyText.trim()}>
                    <Send className="mr-2 h-4 w-4" />
                    Send reply
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
