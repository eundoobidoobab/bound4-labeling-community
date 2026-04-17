import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Board, Notice, Post, Attachment } from '@/types';

const PAGE_SIZE = 20;
const PREVIEW_COMMENTS = 3;

export interface CommentPreview {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
}

export interface CommentsBundle {
  total: number;
  preview: CommentPreview[];
}

interface BoardPage {
  board: Board | null;
  notices: Notice[];
  posts: Post[];
  noticeAttachments: Record<string, Attachment[]>;
  postAttachments: Record<string, Attachment[]>;
  signedUrls: Record<string, string>; // file_path -> signed url (1h)
  captureUrls: Record<string, string>; // post_id -> signed url for capture image
  noticeComments: Record<string, CommentsBundle>;
  postComments: Record<string, CommentsBundle>;
  authorIds: string[];
  hasMore: boolean;
}

async function batchSignedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const unique = [...new Set(paths)];
  const { data } = await supabase.storage.from('board_attachments').createSignedUrls(unique, 3600);
  const map: Record<string, string> = {};
  (data || []).forEach((entry: any) => {
    if (entry?.signedUrl && entry?.path) map[entry.path] = entry.signedUrl;
  });
  return map;
}

async function fetchPostComments(parentIds: string[]): Promise<Record<string, CommentsBundle>> {
  return fetchCommentsGeneric(parentIds, async (ids) =>
    (await supabase.from('comments').select('id, body, author_id, created_at, post_id')
      .in('post_id', ids).order('created_at', { ascending: false })).data || [],
    'post_id',
  );
}

async function fetchNoticeComments(parentIds: string[]): Promise<Record<string, CommentsBundle>> {
  return fetchCommentsGeneric(parentIds, async (ids) =>
    (await supabase.from('notice_comments').select('id, body, author_id, created_at, notice_id')
      .in('notice_id', ids).order('created_at', { ascending: false })).data || [],
    'notice_id',
  );
}

async function fetchCommentsGeneric(
  parentIds: string[],
  loader: (ids: string[]) => Promise<any[]>,
  parentColumn: string,
): Promise<Record<string, CommentsBundle>> {
  const result: Record<string, CommentsBundle> = {};
  parentIds.forEach((id) => { result[id] = { total: 0, preview: [] }; });
  if (parentIds.length === 0) return result;

  const rows = await loader(parentIds);
  rows.forEach((row: any) => {
    const pid = row[parentColumn];
    const bundle = result[pid];
    if (!bundle) return;
    bundle.total += 1;
    if (bundle.preview.length < PREVIEW_COMMENTS) {
      bundle.preview.push({
        id: row.id,
        body: row.body,
        author_id: row.author_id,
        created_at: row.created_at,
      });
    }
  });

  // preview was collected newest-first → reverse to oldest-first for display
  Object.values(result).forEach((b) => { b.preview.reverse(); });
  return result;
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
      const noticeAttachments: Record<string, Attachment[]> = {};
      const postAttachments: Record<string, Attachment[]> = {};
      let signedUrls: Record<string, string> = {};
      const captureUrls: Record<string, string> = {};
      let noticeComments: Record<string, CommentsBundle> = {};
      let postComments: Record<string, CommentsBundle> = {};
      const authorSet = new Set<string>();
      let hasMore = false;

      if (board?.type === 'NOTICE') {
        const { data } = await supabase.from('notices').select('*').eq('board_id', boardId!).eq('status', 'ACTIVE')
          .order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);
        notices = (data || []) as Notice[];
        hasMore = notices.length === PAGE_SIZE;

        if (notices.length > 0) {
          const ids = notices.map((n) => n.id);
          notices.forEach((n) => authorSet.add(n.created_by));

          const [{ data: atts }, commentsBundle] = await Promise.all([
            supabase.from('notice_attachments').select('*').in('notice_id', ids),
            fetchCommentsBundle('notice_comments', 'notice_id', ids),
          ]);

          const allPaths: string[] = [];
          (atts || []).forEach((a: any) => {
            (noticeAttachments[a.notice_id] = noticeAttachments[a.notice_id] || []).push(a);
            allPaths.push(a.file_path);
          });
          noticeComments = commentsBundle;
          Object.values(noticeComments).forEach((b) =>
            b.preview.forEach((c) => authorSet.add(c.author_id)),
          );

          signedUrls = await batchSignedUrls(allPaths);
        }
      } else if (['QNA', 'BUG', 'CUSTOM'].includes(board?.type || '')) {
        const { data } = await supabase.from('posts').select('*').eq('board_id', boardId!).eq('status', 'ACTIVE')
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);
        posts = (data || []) as Post[];
        hasMore = posts.length === PAGE_SIZE;

        if (posts.length > 0) {
          const ids = posts.map((p) => p.id);
          posts.forEach((p) => authorSet.add(p.author_id));

          const [{ data: atts }, commentsBundle] = await Promise.all([
            supabase.from('post_attachments').select('*').in('post_id', ids),
            fetchCommentsBundle('comments', 'post_id', ids),
          ]);

          const allPaths: string[] = [];
          (atts || []).forEach((a: any) => {
            (postAttachments[a.post_id] = postAttachments[a.post_id] || []).push(a);
            allPaths.push(a.file_path);
          });
          postComments = commentsBundle;
          Object.values(postComments).forEach((b) =>
            b.preview.forEach((c) => authorSet.add(c.author_id)),
          );

          // Capture image paths (bug board)
          const capturePaths = posts
            .map((p) => p.capture_image_path)
            .filter((p): p is string => !!p);
          allPaths.push(...capturePaths);

          signedUrls = await batchSignedUrls(allPaths);
          posts.forEach((p) => {
            if (p.capture_image_path && signedUrls[p.capture_image_path]) {
              captureUrls[p.id] = signedUrls[p.capture_image_path];
            }
          });
        }
      }

      return {
        board,
        notices,
        posts,
        noticeAttachments,
        postAttachments,
        signedUrls,
        captureUrls,
        noticeComments,
        postComments,
        authorIds: [...authorSet],
        hasMore,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      const totalItems = allPages.reduce((sum, p) => sum + p.notices.length + p.posts.length, 0);
      return totalItems;
    },
    enabled: !!boardId,
  });

  // Memoize flattened/merged structures for referential stability
  const data = useMemo(() => {
    const pages = query.data?.pages ?? [];
    const board = pages[0]?.board ?? null;
    const notices: Notice[] = [];
    const posts: Post[] = [];
    const noticeAttachments: Record<string, Attachment[]> = {};
    const postAttachments: Record<string, Attachment[]> = {};
    const signedUrls: Record<string, string> = {};
    const captureUrls: Record<string, string> = {};
    const noticeComments: Record<string, CommentsBundle> = {};
    const postComments: Record<string, CommentsBundle> = {};
    const authorSet = new Set<string>();

    pages.forEach((p) => {
      notices.push(...p.notices);
      posts.push(...p.posts);
      Object.assign(noticeAttachments, p.noticeAttachments);
      Object.assign(postAttachments, p.postAttachments);
      Object.assign(signedUrls, p.signedUrls);
      Object.assign(captureUrls, p.captureUrls);
      Object.assign(noticeComments, p.noticeComments);
      Object.assign(postComments, p.postComments);
      p.authorIds.forEach((id) => authorSet.add(id));
    });

    return {
      board,
      notices,
      posts,
      noticeAttachments,
      postAttachments,
      signedUrls,
      captureUrls,
      noticeComments,
      postComments,
      authorIds: [...authorSet],
    };
  }, [query.data]);

  return {
    data,
    isLoading: query.isLoading,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  };
}
