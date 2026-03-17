import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { RootState } from '@/core/store';
import { organizationQueryKey, sessionQueryKey } from '@/core/queryKeys';
import { useSocket } from './useSocket';

const SUPPORT_QUERY_PREFIXES = [
  'support-tickets',
  'support-ticket',
  'support-messages',
  'support-unread',
  'admin-support-tickets',
  'admin-support-ticket',
  'admin-support-messages',
  'admin-support-unread',
  'admin-support-assignable',
] as const;

interface BadgeUpdatePayload {
  unread_count?: number;
  actor_type?: 'user' | 'admin';
  organization_id?: string | null;
}

interface SupportEventPayload {
  ticket_id?: string;
  organization_id?: string | null;
  message?: {
    reply_type?: 'user' | 'admin' | 'system';
  };
}

interface SupportThreadSocketOptions {
  ticketId?: string;
  organizationId?: string | null;
  mode: 'user' | 'admin';
  onIncomingCounterpartyMessage?: () => void;
}

function invalidateSupportQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({
    predicate: (query) =>
      typeof query.queryKey[0] === 'string' &&
      SUPPORT_QUERY_PREFIXES.includes(query.queryKey[0] as (typeof SUPPORT_QUERY_PREFIXES)[number]),
  });
}

function invalidateUserSupportScope(
  queryClient: ReturnType<typeof useQueryClient>,
  userId?: string | null,
  organizationId?: string | null,
  ticketId?: string
) {
  if (!organizationId) {
    invalidateSupportQueries(queryClient);
    return;
  }

  queryClient.invalidateQueries({
    queryKey: organizationQueryKey(['support-unread'], userId, organizationId),
  });
  queryClient.invalidateQueries({
    queryKey: organizationQueryKey(['support-tickets'], userId, organizationId),
  });

  if (ticketId) {
    queryClient.invalidateQueries({
      queryKey: organizationQueryKey(['support-ticket', ticketId], userId, organizationId),
    });
    queryClient.invalidateQueries({
      queryKey: organizationQueryKey(['support-messages', ticketId], userId, organizationId),
    });
  }
}

function invalidateAdminSupportScope(
  queryClient: ReturnType<typeof useQueryClient>,
  userId?: string | null,
  ticketId?: string
) {
  queryClient.invalidateQueries({
    queryKey: sessionQueryKey(['admin-support-unread'], userId),
  });
  queryClient.invalidateQueries({
    queryKey: sessionQueryKey(['admin-support-tickets'], userId),
  });

  if (ticketId) {
    queryClient.invalidateQueries({
      queryKey: sessionQueryKey(['admin-support-ticket', ticketId], userId),
    });
    queryClient.invalidateQueries({
      queryKey: sessionQueryKey(['admin-support-messages', ticketId], userId),
    });
  }
}

export function useSupportSocket() {
  const { supportSocket } = useSocket();
  const queryClient = useQueryClient();
  const userId = useSelector((state: RootState) => state.auth.user?.id || null);

  useEffect(() => {
    if (!supportSocket) {
      return undefined;
    }

    const onBadgeUpdated = (payload: BadgeUpdatePayload = {}) => {
      if (payload.actor_type === 'admin') {
        queryClient.setQueryData(
          sessionQueryKey(['admin-support-unread'], userId),
          Number(payload.unread_count || 0)
        );
        invalidateAdminSupportScope(queryClient, userId);
        return;
      }

      if (payload.organization_id) {
        queryClient.setQueryData(
          organizationQueryKey(['support-unread'], userId, payload.organization_id),
          Number(payload.unread_count || 0)
        );
        invalidateUserSupportScope(queryClient, userId, payload.organization_id);
        return;
      }

      invalidateSupportQueries(queryClient);
    };

    const onTicketUpdated = (payload: SupportEventPayload = {}) => {
      invalidateAdminSupportScope(queryClient, userId, payload.ticket_id);

      if (payload.organization_id) {
        invalidateUserSupportScope(queryClient, userId, payload.organization_id, payload.ticket_id);
        return;
      }

      invalidateSupportQueries(queryClient);
    };

    supportSocket.on('support:badge.updated', onBadgeUpdated);
    supportSocket.on('support:ticket.updated', onTicketUpdated);

    return () => {
      supportSocket.off('support:badge.updated', onBadgeUpdated);
      supportSocket.off('support:ticket.updated', onTicketUpdated);
    };
  }, [supportSocket, queryClient, userId]);
}

export function useSupportThreadSocket({
  ticketId,
  organizationId,
  mode,
  onIncomingCounterpartyMessage,
}: SupportThreadSocketOptions) {
  const { supportSocket } = useSocket();
  const queryClient = useQueryClient();
  const userId = useSelector((state: RootState) => state.auth.user?.id || null);
  const incomingMessageHandlerRef = useRef(onIncomingCounterpartyMessage);

  useEffect(() => {
    incomingMessageHandlerRef.current = onIncomingCounterpartyMessage;
  }, [onIncomingCounterpartyMessage]);

  useEffect(() => {
    if (!supportSocket || !ticketId) {
      return undefined;
    }

    const joinThread = () => {
      supportSocket.emit('support:thread.join', {
        ticketId,
        organizationId: organizationId || undefined,
      });
    };

    const invalidateCurrentThread = () => {
      if (mode === 'admin') {
        invalidateAdminSupportScope(queryClient, userId, ticketId);
        return;
      }

      invalidateUserSupportScope(queryClient, userId, organizationId, ticketId);
    };

    const onMessageCreated = (payload: SupportEventPayload = {}) => {
      if (payload.ticket_id !== ticketId) {
        return;
      }

      invalidateCurrentThread();

      const isCounterpartyMessage =
        (mode === 'user' && payload.message?.reply_type === 'admin') ||
        (mode === 'admin' && payload.message?.reply_type === 'user');

      if (isCounterpartyMessage) {
        incomingMessageHandlerRef.current?.();
      }
    };

    const onThreadEvent = (payload: SupportEventPayload = {}) => {
      if (!payload.ticket_id || payload.ticket_id === ticketId) {
        invalidateCurrentThread();
      }
    };

    joinThread();
    supportSocket.on('connect', joinThread);
    supportSocket.on('support:message.created', onMessageCreated);
    supportSocket.on('support:status.updated', onThreadEvent);
    supportSocket.on('support:assignment.updated', onThreadEvent);
    supportSocket.on('support:thread.read', onThreadEvent);

    return () => {
      supportSocket.off('connect', joinThread);
      supportSocket.emit('support:thread.leave', { ticketId });
      supportSocket.off('support:message.created', onMessageCreated);
      supportSocket.off('support:status.updated', onThreadEvent);
      supportSocket.off('support:assignment.updated', onThreadEvent);
      supportSocket.off('support:thread.read', onThreadEvent);
    };
  }, [supportSocket, ticketId, organizationId, mode, queryClient, userId]);
}
