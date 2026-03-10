import { useEffect, useState } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Megaphone,
  BookOpen,
  HelpCircle,
  BarChart3,
  Bug,
  MessageSquare,
  Users,
  Settings,
  ArrowLeft,
  Bell,
  Loader2,
} from 'lucide-react';

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

const boardIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  NOTICE: Megaphone,
  GUIDE: BookOpen,
  QNA: HelpCircle,
  ALLOCATION: BarChart3,
  BUG: Bug,
  CUSTOM: MessageSquare,
};

function ProjectSidebar({ project, boards }: { project: Project; boards: Board[] }) {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const isProjectHome = location.pathname === `/projects/${id}`;

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="bg-card">
        {/* Project name */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            {project.name.charAt(0)}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{project.name}</p>
              <p className="text-xs text-muted-foreground">
                {role === 'admin' ? '관리자' : '작업자'}
              </p>
            </div>
          )}
        </div>

        {/* Board navigation - Notice is project home */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider">
            게시판
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {boards.map((board) => {
                const Icon = boardIcons[board.type] || MessageSquare;
                // Notice board links to project home
                const boardPath = board.type === 'NOTICE'
                  ? `/projects/${id}`
                  : `/projects/${id}/boards/${board.id}`;
                const isActive = board.type === 'NOTICE'
                  ? isProjectHome
                  : location.pathname === boardPath;

                return (
                  <SidebarMenuItem key={board.id}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink
                        to={boardPath}
                        end={board.type === 'NOTICE'}
                        className="hover:bg-muted/50"
                        activeClassName="bg-primary/10 text-primary font-medium"
                      >
                        <Icon className="h-4 w-4" />
                        {!collapsed && <span>{board.name}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Utility links */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider">
            관리
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === `/projects/${id}/dm`}>
                  <NavLink
                    to={`/projects/${id}/dm`}
                    className="hover:bg-muted/50"
                    activeClassName="bg-primary/10 text-primary font-medium"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {!collapsed && <span>메시지</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === `/projects/${id}/members`}>
                  <NavLink
                    to={`/projects/${id}/members`}
                    className="hover:bg-muted/50"
                    activeClassName="bg-primary/10 text-primary font-medium"
                  >
                    <Users className="h-4 w-4" />
                    {!collapsed && <span>팀 멤버</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {role === 'admin' && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === `/projects/${id}/settings`}>
                    <NavLink
                      to={`/projects/${id}/settings`}
                      className="hover:bg-muted/50"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <Settings className="h-4 w-4" />
                      {!collapsed && <span>설정</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default function ProjectLayout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const [projectRes, boardsRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('boards').select('*').eq('project_id', id).eq('status', 'ACTIVE').order('order_index'),
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
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <ProjectSidebar project={project} boards={boards} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center gap-2 border-b border-border bg-card px-4">
            <SidebarTrigger />
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="gap-1 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              프로젝트 목록
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="icon" onClick={() => navigate('/notifications')}>
              <Bell className="h-4 w-4" />
            </Button>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet context={{ project, boards }} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
