import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Board, Notice, Post, Attachment } from '@/types';

const PAGE_SIZE = 20;

interface BoardPage {
  board: Board | null;
  notices: Notice[];
  posts: Post[];
  noticeAttachments: Record<string, Attachment[]>;
  postAttachments: Record<string, Attachment[]>;
  authorIds: string[];
  hasMore: boolean;
}

export function useBoardData(boardId: string | undefined) {
  const query = useInfiniteQuery<BoardPage, Error>({
    queryKey: ['board', boardId],
    queryFn: async ({ pageParam = 0 }) => {
      const offset = pageParam as number;
      const { data: boardData } = await supabase.from('boards').select('*').eq('id', boardId!).single();
      const board = boardData as Board | null;

      let notices: Notice[] = [];
      let posts: Post[] = [];
      let noticeAttachments: Record<string, Attachment[]> = {};
      let postAttachments: Record<string, Attachment[]> = {};
      let authorIds: string[] = [];
      let hasMore = false;

      if (board?.type === 'NOTICE') {
        const { data } = await supabase.from('notices').select('*').eq('board_id', boardId!).eq('status', 'ACTIVE')
          .order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);
        notices = (data || []) as Notice[];
        hasMore = notices.length === PAGE_SIZE;
        if (notices.length > 0) {
          const { data: atts } = await supabase.from('notice_attachments').select('*').in('notice_id', notices.map(n => n.id));
          (atts || []).forEach((a: any) => { (noticeAttachments[a.notice_id] = noticeAttachments[a.notice_id] || []).push(a); });
          authorIds = notices.map(n => n.created_by);
        }
      } else if (['QNA', 'BUG', 'CUSTOM'].includes(board?.type || '')) {
        const { data } = await supabase.from('posts').select('*').eq('board_id', boardId!).eq('status', 'ACTIVE')
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);
        posts = (data || []) as Post[];
        hasMore = posts.length === PAGE_SIZE;
        if (posts.length > 0) {
          const { data: atts } = await supabase.from('post_attachments').select('*').in('post_id', posts.map(p => p.id));
          (atts || []).forEach((a: any) => { (postAttachments[a.post_id] = postAttachments[a.post_id] || []).push(a); });
          authorIds = posts.map(p => p.author_id);
        }
      }

      return { board, notices, posts, noticeAttachments, postAttachments, authorIds, hasMore };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      const totalItems = allPages.reduce((sum, p) => sum + p.notices.length + p.posts.length, 0);
      return totalItems;
    },
    enabled: !!boardId,
  });

  // Flatten pages into single arrays for backward compatibility
  const allNotices = query.data?.pages.flatMap(p => p.notices) ?? [];
  const allPosts = query.data?.pages.flatMap(p => p.posts) ?? [];
  const allNoticeAttachments = query.data?.pages.reduce<Record<string, Attachment[]>>((acc, p) => ({ ...acc, ...p.noticeAttachments }), {}) ?? {};
  const allPostAttachments = query.data?.pages.reduce<Record<string, Attachment[]>>((acc, p) => ({ ...acc, ...p.postAttachments }), {}) ?? {};
  const allAuthorIds = query.data?.pages.flatMap(p => p.authorIds) ?? [];
  const board = query.data?.pages[0]?.board ?? null;

  return {
    data: {
      board,
      notices: allNotices,
      posts: allPosts,
      noticeAttachments: allNoticeAttachments,
      postAttachments: allPostAttachments,
      authorIds: [...new Set(allAuthorIds)],
    },
    isLoading: query.isLoading,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  };
}
