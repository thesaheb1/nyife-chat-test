import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { useSocket } from '@/core/hooks';
import type { Conversation, ChatMessage, ApiResponse, PaginationMeta } from '@/core/types';

interface ConversationListParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  unread?: boolean;
}

// List conversations
export function useConversations(params: ConversationListParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.unread) query.set('unread', 'true');

  const qs = query.toString();
  const url = `${ENDPOINTS.CHAT.CONVERSATIONS}${qs ? `?${qs}` : ''}`;

  return useQuery<{ data: { conversations: Conversation[] }; meta: PaginationMeta }>({
    queryKey: ['conversations', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ conversations: Conversation[] }>>(url);
      return { data: data.data, meta: data.meta! };
    },
  });
}

// Get single conversation
export function useConversation(id: string | undefined) {
  return useQuery<Conversation>({
    queryKey: ['conversations', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ conversation: Conversation }>>(`${ENDPOINTS.CHAT.CONVERSATIONS}/${id}`);
      return data.data.conversation;
    },
    enabled: !!id,
  });
}

// Get messages for a conversation
export function useMessages(conversationId: string | undefined, params: { page?: number; limit?: number; before?: string } = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.before) query.set('before', params.before);
  const qs = query.toString();

  return useQuery<{ data: { messages: ChatMessage[] }; meta: PaginationMeta }>({
    queryKey: ['messages', conversationId, params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ messages: ChatMessage[] }>>(
        `${ENDPOINTS.CHAT.CONVERSATIONS}/${conversationId}/messages${qs ? `?${qs}` : ''}`
      );
      return { data: data.data, meta: data.meta! };
    },
    enabled: !!conversationId,
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
      qc.invalidateQueries({ queryKey: ['messages', vars.conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

// Assign conversation
export function useAssignConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, member_user_id }: { id: string; member_user_id: string }) => {
      const { data } = await apiClient.post<ApiResponse<{ conversation: Conversation }>>(
        `${ENDPOINTS.CHAT.CONVERSATIONS}/${id}/assign`,
        { member_user_id }
      );
      return data.data.conversation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

// Mark conversation as read
export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`${ENDPOINTS.CHAT.CONVERSATIONS}/${id}/read`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
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
      qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
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
      qc.invalidateQueries({ queryKey: ['messages', conversationId] });
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
      qc.invalidateQueries({ queryKey: ['conversations'] });
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
