import { useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { Loader2, MessageSquare, Pin, MoreHorizontal, Eye } from 'lucide-react';
import FeedComments from '@/components/FeedComments';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import FeedComposer from '@/components/FeedComposer';
import FeedAttachments from '@/components/FeedAttachments';

interface Board {
  id: string;
  name: string;
  type: string;
  order_index: number;
  status: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
}

interface Notice {
  id: string;
  title: string;
  body: string;
  created_at: string;
  created_by: string;
  status: string;
  is_pinned: boolean;
  board_id: string;
}

interface Post {
  id: string;
  title: string;
  body: string;
  author_id: string;
  created_at: string;
  status: string;
  board_id: string;
}

interface Attachment {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
}

interface Profile {
  id: string;
  display_name: string | null;
  email: string;
}

export default function BoardPage() {
  const { boardId } = useParams<{ id: string; boardId: string }>();
  const { project } = useOutletContext<{ project: Project; boards: Board[] }>();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [board, setBoard] = useState<Board | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [noticeAttachments, setNoticeAttachments] = useState<Record<string, Attachment[]>>({});
  const [postAttachments, setPostAttachments] = useState<Record<string, Attachment[]>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  const userProfile = user ? profiles[user.id] : null;
  const userDisplayName = userProfile?.display_name || userProfile?.email || user?.email || 'User';

  useEffect(() => {
    if (!boardId) return;
    fetchData();
  }, [boardId]);

  const fetchData = async () => {
    setLoading(true);
    const { data: boardData } = await supabase.from('boards').select('*').eq('id', boardId!).single();
    if (boardData) setBoard(boardData as Board);

    if (boardData?.type === 'NOTICE') {
      const { data } = await supabase.from('notices').select('*').eq('board_id', boardId!).eq('status', 'ACTIVE')
        .order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
      const items = (data || []) as Notice[];
      setNotices(items);
      if (items.length > 0) {
        const { data: atts } = await supabase.from('notice_attachments').select('*').in('notice_id', items.map(n => n.id));
        const map: Record<string, Attachment[]> = {};
        (atts || []).forEach((a: any) => { (map[a.notice_id] = map[a.notice_id] || []).push(a); });
        setNoticeAttachments(map);
        await fetchProfiles([...new Set(items.map(n => n.created_by))]);
      }
    } else if (['QNA', 'BUG', 'CUSTOM'].includes(boardData?.type || '')) {
      const { data } = await supabase.from('posts').select('*').eq('board_id', boardId!).eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });
      const items = (data || []) as Post[];
      setPosts(items);
      if (items.length > 0) {
        const { data: atts } = await supabase.from('post_attachments').select('*').in('post_id', items.map(p => p.id));
        const map: Record<string, Attachment[]> = {};
        (atts || []).forEach((a: any) => { (map[a.post_id] = map[a.post_id] || []).push(a); });
        setPostAttachments(map);
        await fetchProfiles([...new Set(items.map(p => p.author_id))]);
      }
    }
    // Fetch current user profile too
    if (user) await fetchProfiles([user.id]);
    setLoading(false);
  };

  const fetchProfiles = async (ids: string[]) => {
    const missing = ids.filter(id => !profiles[id]);
    if (missing.length === 0) return;
    const { data } = await supabase.from('profiles').select('id, display_name, email').in('id', missing);
    if (data) {
      setProfiles(prev => {
        const next = { ...prev };
        data.forEach((p: any) => { next[p.id] = p; });
        return next;
      });
    }
  };

  const handleCreateNotice = async ({ title, body, attachmentPaths }: { title: string; body: string; attachmentPaths: any[] }) => {
    if (!user || !boardId) return;
    const { data: inserted, error } = await supabase.from('notices').insert({ board_id: boardId, title, body, created_by: user.id }).select().single();
    if (error) { toast({ title: '생성 실패', description: error.message, variant: 'destructive' }); return; }
    if (attachmentPaths.length > 0 && inserted) {
      await supabase.from('notice_attachments').insert(attachmentPaths.map(a => ({ ...a, notice_id: inserted.id })));
    }
    toast({ title: '공지사항이 등록되었습니다' });
    fetchData();
  };

  const handleCreatePost = async ({ title, body, attachmentPaths }: { title: string; body: string; attachmentPaths: any[] }) => {
    if (!user || !boardId) return;
    const { data: inserted, error } = await supabase.from('posts').insert({ board_id: boardId, title, body, author_id: user.id }).select().single();
    if (error) { toast({ title: '생성 실패', description: error.message, variant: 'destructive' }); return; }
    if (attachmentPaths.length > 0 && inserted) {
      await supabase.from('post_attachments').insert(attachmentPaths.map(a => ({ ...a, post_id: inserted.id })));
    }
    toast({ title: '게시글이 등록되었습니다' });
    fetchData();
  };

  const togglePin = async (notice: Notice) => {
    await supabase.from('notices').update({ is_pinned: !notice.is_pinned }).eq('id', notice.id);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isNotice = board?.type === 'NOTICE';
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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{board?.name || '게시판'}</h1>
        <p className="text-sm text-muted-foreground mt-1">{boardDescriptions[board?.type || ''] || ''}</p>
      </div>

      {/* Inline composer */}
      {canCreate && (
        <div className="mb-6">
          <FeedComposer
            userDisplayName={userDisplayName}
            placeholder={isNotice ? '공지사항을 작성하세요...' : '무엇이든 질문하거나 공유해보세요...'}
            titlePlaceholder={isNotice ? '공지 제목' : '제목'}
            onSubmit={isNotice ? handleCreateNotice : handleCreatePost}
          />
        </div>
      )}

      {/* Placeholder boards */}
      {isAllocation && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">배분 관리 기능은 다음 단계에서 구현됩니다</p>
        </div>
      )}
      {isGuide && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">가이드 관리 기능은 다음 단계에서 구현됩니다</p>
        </div>
      )}

      {/* Notice feed */}
      {isNotice && (
        <div className="space-y-4">
          {notices.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">등록된 공지사항이 없습니다</p>
          ) : (
            notices.map((notice, i) => {
              const author = profiles[notice.created_by];
              return (
                <motion.div key={notice.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card className={notice.is_pinned ? 'border-primary/30 bg-primary/5' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {(author?.display_name || author?.email || '?').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{author?.display_name || author?.email || '알 수 없음'}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(notice.created_at)}
                              </span>
                              {notice.is_pinned && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                                  <Pin className="h-3 w-3" /> 고정
                                </span>
                              )}
                            </div>
                            <CardTitle className="text-base mt-1">{notice.title}</CardTitle>
                          </div>
                        </div>
                        {role === 'admin' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => togglePin(notice)}>
                                <Pin className="mr-2 h-4 w-4" />
                                {notice.is_pinned ? '고정 해제' : '고정'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pl-16">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{notice.body}</p>
                      <FeedAttachments attachments={noticeAttachments[notice.id] || []} />
                      <FeedComments type="notice" parentId={notice.id} />
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Forum feed */}
      {isForum && (
        <div className="space-y-4">
          {posts.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">등록된 게시글이 없습니다</p>
          ) : (
            posts.map((post, i) => {
              const author = profiles[post.author_id];
              return (
                <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {(author?.display_name || author?.email || '?').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{author?.display_name || author?.email || '알 수 없음'}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(post.created_at)}
                            </span>
                          </div>
                          <CardTitle className="text-base mt-1">{post.title}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pl-16">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{post.body}</p>
                      <FeedAttachments attachments={postAttachments[post.id] || []} />
                      <FeedComments type="post" parentId={post.id} />
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
