import { useCallback } from 'react';
import { useRealtimeSubscription } from './useRealtimeSubscription';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  deep_link: string | null;
  is_read: boolean;
  created_at: string;
}

interface UseNotificationsRealtimeOptions {
  userId: string | undefined;
  onNewNotification: (notif: Notification) => void;
}

export function useNotificationsRealtime({
  userId,
  onNewNotification,
}: UseNotificationsRealtimeOptions) {
  const handlePayload = useCallback(
    (payload: any) => {
      onNewNotification(payload.new as Notification);
    },
    [onNewNotification]
  );

  useRealtimeSubscription({
    channelName: `notifications-realtime-${userId}`,
    table: 'notifications',
    event: 'INSERT',
    filter: `user_id=eq.${userId}`,
    enabled: !!userId,
    onPayload: handlePayload,
  });
}
