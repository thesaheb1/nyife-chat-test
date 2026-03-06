import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Search,
  Send,
  Paperclip,
  MoreVertical,
  CheckCheck,
  Check,
  Clock,
  AlertCircle,
  Phone,
  Image,
  FileText,
  MapPin,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useConversations,
  useMessages,
  useSendMessage,
  useMarkAsRead,
  useUpdateConversationStatus,
  useChatSocket,
} from './useChat';
import { useDebounce } from '@/core/hooks';
import { formatPhone } from '@/shared/utils/formatters';
import type { Conversation, ChatMessage } from '@/core/types';

export function ChatPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: convoData, isLoading: convosLoading } = useConversations({
    limit: 50,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
  });
  const conversations = convoData?.data?.conversations ?? [];

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-[calc(100vh-5rem)] -m-4 md:-m-6">
      {/* Conversation List */}
      <div
        className={`w-full border-r md:w-80 lg:w-96 flex flex-col ${
          selectedId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Search & Filter */}
        <div className="border-b p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="h-9 pl-8"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="All conversations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Conversation Items */}
        <ScrollArea className="flex-1">
          {convosLoading ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No conversations found.
            </div>
          ) : (
            <div className="space-y-0.5 p-1">
              {conversations.map((c) => (
                <ConversationItem
                  key={c.id}
                  conversation={c}
                  isActive={c.id === selectedId}
                  onClick={() => setSelectedId(c.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Message Panel */}
      <div
        className={`flex-1 flex flex-col ${
          selectedId ? 'flex' : 'hidden md:flex'
        }`}
      >
        {selected ? (
          <MessagePanel
            conversation={selected}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
}

// --- Conversation Item ---

function ConversationItem({
  conversation: c,
  isActive,
  onClick,
}: {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}) {
  const initials = (c.contact_name || c.contact_phone)
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent ${
        isActive ? 'bg-accent' : ''
      }`}
    >
      <Avatar className="h-10 w-10">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-medium">
            {c.contact_name || formatPhone(c.contact_phone)}
          </span>
          {c.last_message_at && (
            <span className="text-[10px] text-muted-foreground">
              {formatTime(c.last_message_at)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="truncate text-xs text-muted-foreground">
            {c.last_message_preview || 'No messages yet'}
          </span>
          {c.unread_count > 0 && (
            <Badge className="ml-1 h-5 min-w-5 justify-center rounded-full bg-green-500 px-1.5 text-[10px] text-white">
              {c.unread_count}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

// --- Message Panel ---

function MessagePanel({
  conversation,
  onBack,
}: {
  conversation: Conversation;
  onBack: () => void;
}) {
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: msgData, isLoading } = useMessages(conversation.id, { limit: 50 });
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();
  const updateStatus = useUpdateConversationStatus();

  // Socket.IO real-time
  const { emitTyping, emitStopTyping } = useChatSocket(conversation.id);

  const messages = msgData?.data?.messages ?? [];
  // API returns newest first, reverse for display
  const sortedMessages = [...messages].reverse();

  // Mark as read when opening
  useEffect(() => {
    if (conversation.id && conversation.unread_count > 0) {
      markAsRead.mutate(conversation.id);
    }
  }, [conversation.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sortedMessages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    emitStopTyping();
    try {
      await sendMessage.mutateAsync({
        conversationId: conversation.id,
        type: 'text',
        message: { body: trimmed },
        wa_account_id: conversation.wa_account_id,
      });
    } catch {
      toast.error('Failed to send message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Typing indicator
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleInput = (val: string) => {
    setText(val);
    emitTyping();
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(emitStopTyping, 2000);
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onBack}
        >
          <X className="h-4 w-4" />
        </Button>
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs">
            {(conversation.contact_name || conversation.contact_phone)
              .slice(0, 2)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {conversation.contact_name || formatPhone(conversation.contact_phone)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatPhone(conversation.contact_phone)}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] capitalize">
          {conversation.status}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {conversation.status !== 'closed' && (
              <DropdownMenuItem
                onClick={() =>
                  updateStatus.mutate(
                    { id: conversation.id, status: 'closed' },
                    { onSuccess: () => toast.success('Conversation closed') }
                  )
                }
              >
                Close Conversation
              </DropdownMenuItem>
            )}
            {conversation.status === 'closed' && (
              <DropdownMenuItem
                onClick={() =>
                  updateStatus.mutate(
                    { id: conversation.id, status: 'open' },
                    { onSuccess: () => toast.success('Conversation reopened') }
                  )
                }
              >
                Reopen Conversation
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <Skeleton className="h-10 w-48 rounded-xl" />
              </div>
            ))}
          </div>
        ) : sortedMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No messages yet. Send the first message!
          </div>
        ) : (
          <div className="space-y-2">
            {sortedMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            value={text}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="h-9"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

// --- Message Bubble ---

function MessageBubble({ message: msg }: { message: ChatMessage }) {
  const isOutbound = msg.direction === 'outbound';
  const content = msg.content as Record<string, unknown>;

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
          isOutbound
            ? 'bg-green-100 dark:bg-green-900/40 rounded-br-md'
            : 'bg-muted rounded-bl-md'
        }`}
      >
        <MessageContent type={msg.type} content={content} />
        <div className="mt-1 flex items-center justify-end gap-1">
          <span className="text-[10px] text-muted-foreground">
            {new Date(msg.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {isOutbound && <StatusIcon status={msg.status} />}
        </div>
      </div>
    </div>
  );
}

function MessageContent({
  type,
  content,
}: {
  type: string;
  content: Record<string, unknown>;
}) {
  switch (type) {
    case 'text':
      return <p className="whitespace-pre-wrap break-words">{content.body as string}</p>;
    case 'image':
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Image className="h-3 w-3" />
            <span className="text-xs">Image</span>
          </div>
          {typeof content.caption === 'string' && <p className="text-xs">{content.caption}</p>}
        </div>
      );
    case 'video':
      return (
        <div className="flex items-center gap-1 text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span className="text-xs">Video{content.caption ? `: ${content.caption}` : ''}</span>
        </div>
      );
    case 'audio':
      return (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Phone className="h-3 w-3" />
          <span className="text-xs">Audio message</span>
        </div>
      );
    case 'document':
      return (
        <div className="flex items-center gap-1 text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span className="text-xs">{(content.filename as string) || 'Document'}</span>
        </div>
      );
    case 'location':
      return (
        <div className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="text-xs">{(content.name as string) || 'Location'}</span>
        </div>
      );
    case 'sticker':
      return <span className="text-2xl">{(content.emoji as string) || '🏷️'}</span>;
    case 'reaction':
      return <span className="text-xl">{content.emoji as string}</span>;
    case 'template':
      return (
        <div className="text-xs text-muted-foreground italic">
          Template: {content.name as string}
        </div>
      );
    default:
      return <p className="text-xs text-muted-foreground italic">[{type} message]</p>;
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <Clock className="h-3 w-3 text-muted-foreground" />;
    case 'sent':
      return <Check className="h-3 w-3 text-muted-foreground" />;
    case 'delivered':
      return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    case 'read':
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    case 'failed':
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    default:
      return null;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = diff / (1000 * 60 * 60);
  if (hours < 24) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (hours < 48) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
