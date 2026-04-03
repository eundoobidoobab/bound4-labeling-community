import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useDMUnread(projectId: string | undefined) {
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  const check = useCallback(async () => {
    if (!user || !projectId) return;

    // Get all threads for this user in this project
    const { data: threads } = await supabase
      .from('dm_threads')
      .select('id')
      .eq('project_id', projectId)
      .or(`admin_id.eq.${user.id},worker_id.eq.${user.id}`);

    if (!threads || threads.length === 0) {
      setHasUnread(false);
      return;
    }

    const threadIds = threads.map(t => t.id);

    // Get user's read cursors
    const { data: cursors } = await supabase
      .from('dm_read_cursors')
      .select('thread_id, last_read_at')
      .eq('user_id', user.id)
      .in('thread_id', threadIds);

    const cursorMap: Record<string, string> = {};
    (cursors || []).forEach(c => { cursorMap[c.thread_id] = c.last_read_at; });

    // For each thread, check if there are messages after the cursor
    for (const threadId of threadIds) {
      const lastRead = cursorMap[threadId];
      let query = supabase
        .from('dm_messages')
        .select('id', { count: 'exact', head: true })
        .eq('thread_id', threadId)
        .neq('sender_id', user.id);

      if (lastRead) {
        query = query.gt('created_at', lastRead);
      }

      const { count } = await query;
      if (count && count > 0) {
        setHasUnread(true);
        return;
      }
    }

    setHasUnread(false);
  }, [user, projectId]);

  useEffect(() => {
    check();
  }, [check]);

  // Listen for new DM messages in realtime
  useEffect(() => {
    if (!user || !projectId) return;

    const channel = supabase
      .channel(`dm-unread-${projectId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'dm_messages',
      }, () => {
        check();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dm_read_cursors',
      }, () => {
        check();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, projectId, check]);

  return { hasUnreadDM: hasUnread, recheckDMUnread: check };
}
