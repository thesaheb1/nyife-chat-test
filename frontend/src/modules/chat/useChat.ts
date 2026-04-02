import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { useSocket } from '@/core/hooks';
import { invalidateOrganizationScopedQueryPrefixes, organizationQueryKey } from '@/core/queryKeys';
import type { RootState } from '@/core/store';
import type { Conversation, ChatMessage, ApiResponse, PaginationMeta } from '@/core/types';
import { useOrganizationContext } from '@/modules/organizations/useOrganizationContext';

interface ConversationListParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  unread?: boolean;
  wa_account_id?: string;
  assigned_to?: string;
}

function invalidateChatQueries(queryClient: ReturnType<typeof useQueryClient>, conversationId?: string) {
  const prefixes: Array<readonly unknown[]> = [['conversations']];

  if (conversationId) {
    prefixes.push(
      ['conversations', conversationId],
      ['messages', conversationId]
    );
  }

  invalidateOrganizationScopedQueryPrefixes(queryClient, prefixes);
}

// List conversations
export function useConversations(params: ConversationListParams = {}) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.unread) query.set('unread', 'true');
  if (params.wa_account_id) query.set('wa_account_id', params.wa_account_id);
  if (params.assigned_to) query.set('assigned_to', params.assigned_to);

  const qs = query.toString();
  const url = `${ENDPOINTS.CHAT.CONVERSATIONS}${qs ? `?${qs}` : ''}`;

  return useQuery<{ data: { conversations: Conversation[] }; meta: PaginationMeta }>({
    queryKey: organizationQueryKey(['conversations', params] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ conversations: Conversation[] }>>(url);
      return { data: data.data, meta: data.meta! };
    },
    enabled: Boolean(userId && activeOrganization?.id),
  });
}

// Get single conversation
export function useConversation(id: string | undefined) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  return useQuery<Conversation>({
    queryKey: organizationQueryKey(['conversations', id] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ conversation: Conversation }>>(`${ENDPOINTS.CHAT.CONVERSATIONS}/${id}`);
      return data.data.conversation;
    },
    enabled: Boolean(id && userId && activeOrganization?.id),
  });
}

// Get messages for a conversation
export function useMessages(conversationId: string | undefined, params: { page?: number; limit?: number; before?: string } = {}) {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.before) query.set('before', params.before);
  const qs = query.toString();

  return useQuery<{ data: { messages: ChatMessage[] }; meta: PaginationMeta }>({
    queryKey: organizationQueryKey(['messages', conversationId, params] as const, userId, activeOrganization?.id),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ messages: ChatMessage[] }>>(
        `${ENDPOINTS.CHAT.CONVERSATIONS}/${conversationId}/messages${qs ? `?${qs}` : ''}`
      );
      return { data: data.data, meta: data.meta! };
    },
    enabled: Boolean(conversationId && userId && activeOrganization?.id),
  });
}

// Send message
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      type,
      message,
      wa_account_id,
    }: {
      conversationId: string;
      type: string;
      message: Record<string, unknown>;
      wa_account_id: string;
    }) => {
      const { data } = await apiClient.post<ApiResponse<{ message: ChatMessage }>>(
        `${ENDPOINTS.CHAT.CONVERSATIONS}/${conversationId}/send`,
        { type, message, wa_account_id }
      );
      return data.data.message;
    },
    onSuccess: (_data, vars) => {
      invalidateChatQueries(qc, vars.conversationId);
    },
  });
}

// Assign conversation
export function useAssignConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, member_user_id }: { id: string; member_user_id: string | null }) => {
      const { data } = await apiClient.post<ApiResponse<{ conversation: Conversation }>>(
        `${ENDPOINTS.CHAT.CONVERSATIONS}/${id}/assign`,
        { member_user_id }
      );
      return data.data.conversation;
    },
    onSuccess: (conversation) => invalidateChatQueries(qc, conversation?.id),
  });
}

// Update conversation status
export function useUpdateConversationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await apiClient.put<ApiResponse<{ conversation: Conversation }>>(
        `${ENDPOINTS.CHAT.CONVERSATIONS}/${id}/status`,
        { status }
      );
      return data.data.conversation;
    },
    onSuccess: (conversation) => invalidateChatQueries(qc, conversation?.id),
  });
}

// Mark conversation as read
export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`${ENDPOINTS.CHAT.CONVERSATIONS}/${id}/read`);
    },
    onSuccess: (_data, id) => invalidateChatQueries(qc, id),
  });
}

export function useChatRealtime() {
  const { chatSocket } = useSocket();
  const qc = useQueryClient();

  useEffect(() => {
    if (!chatSocket) return;

    const invalidateInbox = () => {
      invalidateChatQueries(qc);
    };

    chatSocket.on('conversation:updated', invalidateInbox);
    chatSocket.on('conversation:status', invalidateInbox);
    chatSocket.on('conversation:read', invalidateInbox);
    chatSocket.on('conversation:assigned', invalidateInbox);

    return () => {
      chatSocket.off('conversation:updated', invalidateInbox);
      chatSocket.off('conversation:status', invalidateInbox);
      chatSocket.off('conversation:read', invalidateInbox);
      chatSocket.off('conversation:assigned', invalidateInbox);
    };
  }, [chatSocket, qc]);
}

// Socket.IO real-time hook for chat
export function useChatSocket(conversationId: string | undefined, onNewMessage?: (msg: ChatMessage) => void) {
  const { chatSocket } = useSocket();
  const qc = useQueryClient();
  const callbackRef = useRef(onNewMessage);
  callbackRef.current = onNewMessage;

  // Join/leave conversation room
  useEffect(() => {
    if (!chatSocket || !conversationId) return;
    chatSocket.emit('join:conversation', { conversationId });
    return () => {
      chatSocket.emit('leave:conversation', { conversationId });
    };
  }, [chatSocket, conversationId]);

  // Listen for new messages
  useEffect(() => {
    if (!chatSocket) return;
    const handler = (payload: { message: ChatMessage }) => {
      callbackRef.current?.(payload.message);
      invalidateChatQueries(qc, conversationId);
    };
    chatSocket.on('new:message', handler);
    return () => {
      chatSocket.off('new:message', handler);
    };
  }, [chatSocket, conversationId, qc]);

  // Listen for message status updates
  useEffect(() => {
    if (!chatSocket) return;
    const handler = () => {
      invalidateChatQueries(qc, conversationId);
    };
    chatSocket.on('message:status', handler);
    return () => {
      chatSocket.off('message:status', handler);
    };
  }, [chatSocket, conversationId, qc]);

  // Listen for conversation updates (for sidebar)
  useEffect(() => {
    if (!chatSocket) return;
    const handler = () => {
      invalidateChatQueries(qc, conversationId);
    };
    chatSocket.on('conversation:updated', handler);
    chatSocket.on('conversation:status', handler);
    chatSocket.on('conversation:read', handler);
    chatSocket.on('conversation:assigned', handler);
    return () => {
      chatSocket.off('conversation:updated', handler);
      chatSocket.off('conversation:status', handler);
      chatSocket.off('conversation:read', handler);
      chatSocket.off('conversation:assigned', handler);
    };
  }, [chatSocket, qc]);

  const emitTyping = useCallback(() => {
    if (chatSocket && conversationId) {
      chatSocket.emit('typing', { conversationId });
    }
  }, [chatSocket, conversationId]);

  const emitStopTyping = useCallback(() => {
    if (chatSocket && conversationId) {
      chatSocket.emit('stop:typing', { conversationId });
    }
  }, [chatSocket, conversationId]);

  return { emitTyping, emitStopTyping, chatSocket };
}
