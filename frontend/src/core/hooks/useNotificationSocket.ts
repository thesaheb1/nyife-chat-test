import { useEffect } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';
import type { Notification } from '@/core/types';

/**
 * Global hook that listens on the notification socket for real-time events.
 * Should be mounted once at the app layout level.
 */
export function useNotificationSocket() {
  const { notificationSocket } = useSocket();
  const qc = useQueryClient();

  useEffect(() => {
    if (!notificationSocket) return;

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
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['campaigns', payload.campaign_id] });
      qc.invalidateQueries({ queryKey: ['campaign-analytics', payload.campaign_id] });
      if (payload.status === 'completed') {
        toast.success('Campaign completed');
      } else if (payload.status === 'failed') {
        toast.error('Campaign failed');
      }
    };

    // Campaign progress (sent/delivered/read count updates)
    const onCampaignProgress = (payload: { campaign_id: string }) => {
      qc.invalidateQueries({ queryKey: ['campaign-analytics', payload.campaign_id] });
      qc.invalidateQueries({ queryKey: ['campaign-messages', payload.campaign_id] });
    };

    notificationSocket.on('notification', onNotification);
    notificationSocket.on('unread-count', onUnreadCount);
    notificationSocket.on('campaign:status', onCampaignStatus);
    notificationSocket.on('campaign:progress', onCampaignProgress);

    return () => {
      notificationSocket.off('notification', onNotification);
      notificationSocket.off('unread-count', onUnreadCount);
      notificationSocket.off('campaign:status', onCampaignStatus);
      notificationSocket.off('campaign:progress', onCampaignProgress);
    };
  }, [notificationSocket, qc]);
}
