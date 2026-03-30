import { useEffect, useState, useMemo } from 'react';
import { getProjectMemberIds, sendNotifications } from '@/lib/notifications';
import { useParams, useOutletContext } from 'react-router-dom';
import { markBoardVisited } from '@/hooks/useBoardUnread';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { Loader2, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import FeedComposer from '@/components/FeedComposer';
import BugReportComposer from '@/components/BugReportComposer';
import { NoticeCard, PostCard } from '@/components/FeedCards';
import GuideBoard from '@/components/GuideBoard';
import AllocationBoard from '@/components/AllocationBoard';
import { useProfiles } from '@/hooks/useProfiles';
import { useBoardData } from '@/hooks/useBoardData';
import { useQueryClient } from '@tanstack/react-query';
import type { Board, Project } from '@/types';

export default function BoardPage() {
  const { boardId } = useParams<{ id: string; boardId: string }>();
  const { project, recheckUnread } = useOutletContext<{ project: Project; boards: Board[]; recheckUnread?: () => void }>();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { profiles, fetchProfiles } = useProfiles();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { data, isLoading } = useBoardData(boardId);

  const board = data?.board ?? null;
  const notices = data?.notices ?? [];
  const posts = data?.posts ?? [];
  const noticeAttachments = data?.noticeAttachments ?? {};
  const postAttachments = data?.postAttachments ?? {};

  useEffect(() => {
    if (data?.authorIds && data.authorIds.length > 0) fetchProfiles(data.authorIds);
    if (user) fetchProfiles([user.id]);
  }, [data?.authorIds, user]);

  // Mark board as visited
  useEffect(() => {
    if (user && boardId) {
      markBoardVisited(user.id, boardId).then(() => recheckUnread?.());
    }
  }, [user, boardId]);

  const userProfile = user ? profiles[user.id] : null;
  const userDisplayName = userProfile?.display_name || userProfile?.email || user?.email || 'User';
  const invalidateBoard = () => queryClient.invalidateQueries({ queryKey: ['board', boardId] });

  const q = searchQuery.toLowerCase().trim();
  const filteredNotices = useMemo(() =>
    q ? notices.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)) : notices,
    [notices, q]
  );
  const filteredPosts = useMemo(() =>
    q ? posts.filter(p => p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q)) : posts,
    [posts, q]
  );

  const handleCreateNotice = async ({ title, body, attachmentPaths }: { title: string; body: string; attachmentPaths: any[] }) => {
    if (!user || !boardId) return;
    const { data: inserted, error } = await supabase.from('notices').insert({ board_id: boardId, title, body, created_by: user.id }).select().single();
    if (error) { toast({ title: '생성 실패', description: error.message, variant: 'destructive' }); return; }
    if (attachmentPaths.length > 0 && inserted) {
      await supabase.from('notice_attachments').insert(attachmentPaths.map(a => ({ ...a, notice_id: inserted.id })));
    }
    const memberIds = await getProjectMemberIds(project.id, [user.id]);
    await sendNotifications({ userIds: memberIds, type: 'NOTICE_PUBLISHED', title: '새 공지사항', body: title, projectId: project.id, deepLink: `/projects/${project.id}/boards/${boardId}` });
    toast({ title: '공지사항이 등록되었습니다' });
    invalidateBoard();
  };

  const handleCreatePost = async ({ title, body, attachmentPaths, data_no, worker_ref, capture_image_path }: { title: string; body: string; attachmentPaths: any[]; data_no?: string; worker_ref?: string; capture_image_path?: string }) => {
    if (!user || !boardId) return;
    const insertData: any = { board_id: boardId, title, body, author_id: user.id };
    if (data_no) insertData.data_no = data_no;
    if (worker_ref) insertData.worker_ref = worker_ref;
    if (capture_image_path) insertData.capture_image_path = capture_image_path;
    const { data: inserted, error } = await supabase.from('posts').insert(insertData).select().single();
    if (error) { toast({ title: '생성 실패', description: error.message, variant: 'destructive' }); return; }
    if (attachmentPaths.length > 0 && inserted) {
      await supabase.from('post_attachments').insert(attachmentPaths.map(a => ({ ...a, post_id: inserted.id })));
    }
    toast({ title: '게시글이 등록되었습니다' });
    invalidateBoard();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isNotice = board?.type === 'NOTICE';
  const isBug = board?.type === 'BUG';
  const isForum = ['QNA', 'BUG', 'CUSTOM'].includes(board?.type || '');
  const isAllocation = board?.type === 'ALLOCATION';
  const isGuide = board?.type === 'GUIDE';
  const canCreate = isNotice ? role === 'admin' : isForum;

  const boardDescriptions: Record<string, string> = {
    NOTICE: '중요한 공지사항을 확인하세요',
    QNA: '질문을 올리고 답변을 받아보세요',
    BUG: '버그를 신고하고 해결 상태를 확인하세요',
    ALLOCATION: '작업 배분 현황을 확인하세요',
    GUIDE: '작업 가이드 문서를 확인하세요',
    CUSTOM: '자유롭게 글을 올려보세요',
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{board?.name || '게시판'}</h1>
        <p className="text-sm text-muted-foreground mt-1">{boardDescriptions[board?.type || ''] || ''}</p>
      </div>

      {canCreate && (
        <div className="mb-6">
          {isBug ? (
            <BugReportComposer
              userDisplayName={userDisplayName}
              projectId={project.id}
              onSubmit={handleCreatePost}
            />
          ) : (
            <FeedComposer
              userDisplayName={userDisplayName}
              projectId={project.id}
              placeholder={isNotice ? '공지사항을 작성하세요...' : '무엇이든 질문하거나 공유해보세요...'}
              titlePlaceholder={isNotice ? '공지 제목' : '제목'}
              onSubmit={isNotice ? handleCreateNotice : handleCreatePost}
            />
          )}
        </div>
      )}

      {(isNotice || isForum) && (notices.length > 0 || posts.length > 0) && (
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="제목 또는 내용으로 검색..." className="pl-9 pr-9" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {isAllocation && <AllocationBoard boardId={boardId!} projectId={project.id} />}
      {isGuide && <GuideBoard boardId={boardId!} projectId={project.id} />}

      {isNotice && (
        <div className="space-y-4">
          {filteredNotices.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">{q ? '검색 결과가 없습니다' : '등록된 공지사항이 없습니다'}</p>
          ) : filteredNotices.map((notice, i) => (
            <motion.div key={notice.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <NoticeCard
                notice={notice}
                author={profiles[notice.created_by]}
                attachments={noticeAttachments[notice.id] || []}
                isAdmin={role === 'admin'}
                isEditing={editingId === notice.id}
                onEdit={() => setEditingId(notice.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={async (title, body) => {
                  await supabase.from('notices').update({ title, body }).eq('id', notice.id);
                  toast({ title: '공지사항이 수정되었습니다' });
                  setEditingId(null);
                  invalidateBoard();
                }}
                onDelete={async () => {
                  await supabase.from('notices').delete().eq('id', notice.id);
                  toast({ title: '공지사항이 삭제되었습니다' });
                  invalidateBoard();
                }}
                onTogglePin={async () => {
                  await supabase.from('notices').update({ is_pinned: !notice.is_pinned }).eq('id', notice.id);
                  invalidateBoard();
                }}
              />
            </motion.div>
          ))}
        </div>
      )}

      {isForum && (
        <div className="space-y-4">
          {filteredPosts.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">{q ? '검색 결과가 없습니다' : '등록된 게시글이 없습니다'}</p>
          ) : filteredPosts.map((post, i) => (
            <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <PostCard
                post={post}
                author={profiles[post.author_id]}
                attachments={postAttachments[post.id] || []}
                canManage={post.author_id === user?.id || role === 'admin'}
                isBugBoard={isBug}
                isEditing={editingId === post.id}
                onEdit={() => setEditingId(post.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={async (title, body) => {
                  await supabase.from('posts').update({ title, body }).eq('id', post.id);
                  toast({ title: '게시글이 수정되었습니다' });
                  setEditingId(null);
                  invalidateBoard();
                }}
                onDelete={async () => {
                  await supabase.from('posts').delete().eq('id', post.id);
                  toast({ title: '게시글이 삭제되었습니다' });
                  invalidateBoard();
                }}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
