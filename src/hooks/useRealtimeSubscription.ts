import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeOptions {
  channelName: string;
  table: string;
  schema?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  enabled?: boolean;
  onPayload: (payload: RealtimePostgresChangesPayload<any>) => void;
}

/**
 * Supabase realtime 구독을 안전하게 관리하는 훅.
 * 언마운트 시 자동으로 채널을 정리하고, 의존성 변경 시 재구독한다.
 */
export function useRealtimeSubscription({
  channelName,
  table,
  schema = 'public',
  event = 'INSERT',
  filter,
  enabled = true,
  onPayload,
}: UseRealtimeOptions) {
  const callbackRef = useRef(onPayload);
  callbackRef.current = onPayload;

  useEffect(() => {
    if (!enabled) return;

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event,
          schema,
          table,
          ...(filter ? { filter } : {}),
        } as any,
        (payload: RealtimePostgresChangesPayload<any>) => {
          callbackRef.current(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, table, schema, event, filter, enabled]);
}
