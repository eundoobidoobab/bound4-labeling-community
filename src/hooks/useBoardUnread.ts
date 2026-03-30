import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Board } from '@/types';

/**
 * Tracks which boards have new (unread) content since the user's last visit.
 * Returns a Set of board IDs that have unread posts/notices.
 */
export function useBoardUnread(boards: Board[]) {
  const { user } = useAuth();
  const [unreadBoardIds, setUnreadBoardIds] = useState<Set<string>>(new Set());

  const checkUnread = useCallback(async () => {
    if (!user || boards.length === 0) return;

    const boardIds = boards.map((b) => b.id);

    // Fetch user's last visit times for all boards
    const { data: visits } = await supabase
      .from('board_visits')
      .select('board_id, last_visited_at')
      .eq('user_id', user.id)
      .in('board_id', boardIds);

    const visitMap: Record<string, string> = {};
    visits?.forEach((v) => {
      visitMap[v.board_id] = v.last_visited_at;
    });

    const unread = new Set<string>();

    // Check each board for new content
    for (const board of boards) {
      const lastVisit = visitMap[board.id];

      if (board.type === 'NOTICE') {
        // Check notices table
        let query = supabase
          .from('notices')
          .select('id', { count: 'exact', head: true })
          .eq('board_id', board.id)
          .eq('status', 'ACTIVE');

        if (lastVisit) {
          query = query.gt('created_at', lastVisit);
        }

        const { count } = await query;
        if (count && count > 0) unread.add(board.id);
      } else if (['QNA', 'BUG', 'CUSTOM'].includes(board.type)) {
        // Check posts table
        let query = supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('board_id', board.id)
          .eq('status', 'ACTIVE');

        if (lastVisit) {
          query = query.gt('created_at', lastVisit);
        }

        const { count } = await query;
        if (count && count > 0) unread.add(board.id);
      }
      // GUIDE and ALLOCATION boards don't use posts/notices — skip for now
    }

    setUnreadBoardIds(unread);
  }, [user, boards]);

  useEffect(() => {
    checkUnread();

    // Re-check every 60 seconds
    const interval = setInterval(checkUnread, 60_000);
    return () => clearInterval(interval);
  }, [checkUnread]);

  return { unreadBoardIds, recheckUnread: checkUnread };
}

/**
 * Records/updates the user's visit timestamp for a specific board.
 */
export async function markBoardVisited(userId: string, boardId: string) {
  await supabase
    .from('board_visits')
    .upsert(
      { user_id: userId, board_id: boardId, last_visited_at: new Date().toISOString() },
      { onConflict: 'user_id,board_id' }
    );
}
