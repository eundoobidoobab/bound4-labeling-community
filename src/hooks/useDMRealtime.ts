import { useCallback } from 'react';
import { useRealtimeSubscription } from './useRealtimeSubscription';

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

interface UseDMRealtimeOptions {
  activeThreadId: string | null;
  userId: string | undefined;
  onNewMessage: (msg: Message) => void;
  onReadCursorUpdate: (cursor: { user_id: string; last_read_at: string }) => void;
}

export function useDMRealtime({
  activeThreadId,
  userId,
  onNewMessage,
  onReadCursorUpdate,
}: UseDMRealtimeOptions) {
  const handleMessage = useCallback(
    (payload: any) => {
      onNewMessage(payload.new as Message);
    },
    [onNewMessage]
  );

  const handleCursor = useCallback(
    (payload: any) => {
      const cursor = payload.new;
      if (cursor?.user_id) {
        onReadCursorUpdate(cursor);
      }
    },
    [onReadCursorUpdate]
  );

  useRealtimeSubscription({
    channelName: `dm-${activeThreadId}`,
    table: 'dm_messages',
    event: 'INSERT',
    filter: `thread_id=eq.${activeThreadId}`,
    enabled: !!activeThreadId && !!userId,
    onPayload: handleMessage,
  });

  useRealtimeSubscription({
    channelName: `dm-read-${activeThreadId}`,
    table: 'dm_read_cursors',
    event: '*',
    filter: `thread_id=eq.${activeThreadId}`,
    enabled: !!activeThreadId && !!userId,
    onPayload: handleCursor,
  });
}
