import { useOutletContext, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Megaphone, BookOpen, HelpCircle, BarChart3, Bug, MessageSquare } from 'lucide-react';

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
  const { project, boards } = useOutletContext<{ project: Project; boards: Board[] }>();
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">게시판을 선택하거나 좌측 메뉴를 이용하세요</p>
      </div>

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
              onClick={() => navigate(`/projects/${project.id}/boards/${board.id}`)}
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
                  <span className="text-xs text-muted-foreground">보관됨</span>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
