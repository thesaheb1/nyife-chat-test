import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';
import type { Notification } from '@/core/types';
import { invalidateOrganizationScopedQueryPrefixes } from '@/core/queryKeys';

/**
 * Global hook that listens on the notification socket for real-time events.
 * Should be mounted once at the app layout level.
 */
export function useNotificationSocket() {
  const { notificationSocket } = useSocket();
  const qc = useQueryClient();
  const campaignRefreshTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!notificationSocket) return;

    const queueCampaignRefresh = (campaignId?: string | null) => {
      if (!campaignId) {
        return;
      }

      if (campaignRefreshTimersRef.current.has(campaignId)) {
        return;
      }

      const timer = setTimeout(() => {
        campaignRefreshTimersRef.current.delete(campaignId);
        invalidateOrganizationScopedQueryPrefixes(qc, [
          ['campaigns'],
          ['campaigns', campaignId],
          ['campaigns', campaignId, 'analytics'],
          ['campaigns', campaignId, 'messages'],
        ]);
      }, 150);

      campaignRefreshTimersRef.current.set(campaignId, timer);
    };

    // New notification arrives
    const onNotification = (payload: { notification: Notification }) => {
      const n = payload.notification;
      // Show toast based on type
      if (n.type === 'error') {
        toast.error(n.title, { description: n.body });
      } else if (n.type === 'warning') {
        toast.warning(n.title, { description: n.body });
      } else if (n.type === 'success') {
        toast.success(n.title, { description: n.body });
      } else {
        toast.info(n.title, { description: n.body });
      }
      // Refresh notification queries
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-notifications'] });
    };

    // Unread count changed
    const onUnreadCount = () => {
      qc.invalidateQueries({ queryKey: ['unread-notifications'] });
    };

    // Campaign status update (real-time progress)
    const onCampaignStatus = (payload: { campaign_id: string; status: string }) => {
      queueCampaignRefresh(payload.campaign_id);
      if (payload.status === 'completed') {
        toast.success('Campaign completed');
      } else if (payload.status === 'failed') {
        toast.error('Campaign failed');
      }
    };

    // Campaign progress (sent/delivered/read count updates)
    const onCampaignProgress = (payload: { campaign_id: string }) => {
      queueCampaignRefresh(payload.campaign_id);
    };

    notificationSocket.on('notification', onNotification);
    notificationSocket.on('unread-count', onUnreadCount);
    notificationSocket.on('campaign:status', onCampaignStatus);
    notificationSocket.on('campaign:progress', onCampaignProgress);

    return () => {
      campaignRefreshTimersRef.current.forEach((timer) => clearTimeout(timer));
      campaignRefreshTimersRef.current.clear();
      notificationSocket.off('notification', onNotification);
      notificationSocket.off('unread-count', onUnreadCount);
      notificationSocket.off('campaign:status', onCampaignStatus);
      notificationSocket.off('campaign:progress', onCampaignProgress);
    };
  }, [notificationSocket, qc]);
}
