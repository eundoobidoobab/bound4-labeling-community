import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Board, Notice, Post, Attachment } from '@/types';

interface BoardData {
  board: Board | null;
  notices: Notice[];
  posts: Post[];
  noticeAttachments: Record<string, Attachment[]>;
  postAttachments: Record<string, Attachment[]>;
  authorIds: string[];
}

export function useBoardData(boardId: string | undefined) {
  return useQuery<BoardData>({
    queryKey: ['board', boardId],
    queryFn: async () => {
      const { data: boardData } = await supabase.from('boards').select('*').eq('id', boardId!).single();
      const board = boardData as Board | null;

      let notices: Notice[] = [];
      let posts: Post[] = [];
      let noticeAttachments: Record<string, Attachment[]> = {};
      let postAttachments: Record<string, Attachment[]> = {};
      let authorIds: string[] = [];

      if (board?.type === 'NOTICE') {
        const { data } = await supabase.from('notices').select('*').eq('board_id', boardId!).eq('status', 'ACTIVE')
          .order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
        notices = (data || []) as Notice[];
        if (notices.length > 0) {
          const { data: atts } = await supabase.from('notice_attachments').select('*').in('notice_id', notices.map(n => n.id));
          (atts || []).forEach((a: any) => { (noticeAttachments[a.notice_id] = noticeAttachments[a.notice_id] || []).push(a); });
          authorIds = notices.map(n => n.created_by);
        }
      } else if (['QNA', 'BUG', 'CUSTOM'].includes(board?.type || '')) {
        const { data } = await supabase.from('posts').select('*').eq('board_id', boardId!).eq('status', 'ACTIVE')
          .order('created_at', { ascending: false });
        posts = (data || []) as Post[];
        if (posts.length > 0) {
          const { data: atts } = await supabase.from('post_attachments').select('*').in('post_id', posts.map(p => p.id));
          (atts || []).forEach((a: any) => { (postAttachments[a.post_id] = postAttachments[a.post_id] || []).push(a); });
          authorIds = posts.map(p => p.author_id);
        }
      }

      return { board, notices, posts, noticeAttachments, postAttachments, authorIds };
    },
    enabled: !!boardId,
  });
}
