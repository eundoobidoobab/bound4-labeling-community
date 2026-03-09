import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Megaphone, BookOpen, HelpCircle, BarChart3, Bug, MessageSquare, Settings } from 'lucide-react';

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

const boardIcons: Record<string, React.ReactNode> = {
  NOTICE: <Megaphone className="h-5 w-5" />,
  GUIDE: <BookOpen className="h-5 w-5" />,
  QNA: <HelpCircle className="h-5 w-5" />,
  ALLOCATION: <BarChart3 className="h-5 w-5" />,
  BUG: <Bug className="h-5 w-5" />,
  CUSTOM: <MessageSquare className="h-5 w-5" />,
};

const boardDescriptions: Record<string, string> = {
  NOTICE: '공지사항 및 안내',
  GUIDE: '작업 가이드 문서',
  QNA: '질문과 답변',
  ALLOCATION: '작업 배분 관리',
  BUG: '버그 리포트',
  CUSTOM: '자유 게시판',
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const [projectRes, boardsRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('boards').select('*').eq('project_id', id).order('order_index'),
      ]);
      if (projectRes.data) setProject(projectRes.data as Project);
      if (boardsRes.data) setBoards(boardsRes.data as Board[]);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">프로젝트를 찾을 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">{project.name}</h1>
          </div>
          {role === 'admin' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${id}/dm`)}>
                <MessageSquare className="mr-2 h-4 w-4" />
                메시지
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          )}
          {role === 'worker' && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/projects/${id}/dm`)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              메시지
            </Button>
          )}
        </div>
      </header>

      <main className="container py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board, i) => (
            <motion.div
              key={board.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => navigate(`/projects/${id}/boards/${board.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {boardIcons[board.type] || <MessageSquare className="h-5 w-5" />}
                    </div>
                    <div>
                      <CardTitle className="text-base">{board.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {boardDescriptions[board.type] || ''}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {board.status === 'ARCHIVED' && (
                    <span className="status-archived">보관됨</span>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
