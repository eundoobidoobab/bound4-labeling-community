import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Plus, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Board {
  id: string;
  project_id: string;
  name: string;
  type: string;
}

interface Notice {
  id: string;
  title: string;
  body: string;
  created_at: string;
  status: string;
}

interface Post {
  id: string;
  title: string;
  body: string;
  author_id: string;
  created_at: string;
  status: string;
}

export default function BoardPage() {
  const { id: projectId, boardId } = useParams<{ id: string; boardId: string }>();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [board, setBoard] = useState<Board | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!boardId) return;
    const fetchData = async () => {
      const { data: boardData } = await supabase
        .from('boards')
        .select('*')
        .eq('id', boardId)
        .single();
      if (boardData) setBoard(boardData as Board);

      if (boardData?.type === 'NOTICE') {
        const { data } = await supabase
          .from('notices')
          .select('*')
          .eq('board_id', boardId)
          .eq('status', 'ACTIVE')
          .order('created_at', { ascending: false });
        if (data) setNotices(data as Notice[]);
      } else if (['QNA', 'BUG', 'CUSTOM'].includes(boardData?.type || '')) {
        const { data } = await supabase
          .from('posts')
          .select('*')
          .eq('board_id', boardId)
          .eq('status', 'ACTIVE')
          .order('created_at', { ascending: false });
        if (data) setPosts(data as Post[]);
      }
      setLoading(false);
    };
    fetchData();
  }, [boardId]);

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !boardId) return;
    setSubmitting(true);
    const { error } = await supabase.from('notices').insert({
      board_id: boardId,
      title,
      body,
      created_by: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: '생성 실패', description: error.message, variant: 'destructive' });
    } else {
      setTitle('');
      setBody('');
      setCreateOpen(false);
      toast({ title: '공지사항이 등록되었습니다' });
      // refetch
      const { data } = await supabase
        .from('notices')
        .select('*')
        .eq('board_id', boardId)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });
      if (data) setNotices(data as Notice[]);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !boardId) return;
    setSubmitting(true);
    const { error } = await supabase.from('posts').insert({
      board_id: boardId,
      title,
      body,
      author_id: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: '생성 실패', description: error.message, variant: 'destructive' });
    } else {
      setTitle('');
      setBody('');
      setCreateOpen(false);
      toast({ title: '게시글이 등록되었습니다' });
      const { data } = await supabase
        .from('posts')
        .select('*')
        .eq('board_id', boardId)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });
      if (data) setPosts(data as Post[]);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isNotice = board?.type === 'NOTICE';
  const isForum = ['QNA', 'BUG', 'CUSTOM'].includes(board?.type || '');
  const isAllocation = board?.type === 'ALLOCATION';
  const isGuide = board?.type === 'GUIDE';
  const canCreate = isNotice ? role === 'admin' : isForum;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="flex-1 text-lg font-bold">{board?.name || '게시판'}</h1>
          {canCreate && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  {isNotice ? '공지 작성' : '글 작성'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{isNotice ? '공지사항 작성' : '게시글 작성'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={isNotice ? handleCreateNotice : handleCreatePost} className="space-y-4">
                  <div className="space-y-2">
                    <Label>제목</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>내용</Label>
                    <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    등록
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <main className="container max-w-3xl py-6">
        {isAllocation && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground">배분 관리 기능은 다음 단계에서 구현됩니다</p>
            {role === 'admin' && (
              <Button className="mt-4" onClick={() => navigate(`/projects/${projectId}/admin/allocation`)}>
                배분 관리 페이지로 이동
              </Button>
            )}
          </div>
        )}

        {isGuide && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground">가이드 관리 기능은 다음 단계에서 구현됩니다</p>
          </div>
        )}

        {isNotice && (
          <div className="space-y-3">
            {notices.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">등록된 공지사항이 없습니다</p>
            ) : (
              notices.map((notice, i) => (
                <motion.div
                  key={notice.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{notice.title}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {new Date(notice.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{notice.body}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        )}

        {isForum && (
          <div className="space-y-3">
            {posts.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">등록된 게시글이 없습니다</p>
            ) : (
              posts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">{post.title}</CardTitle>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(post.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{post.body}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
