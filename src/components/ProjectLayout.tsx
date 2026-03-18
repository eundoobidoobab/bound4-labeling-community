import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Board, Project } from '@/types';
import { useProjectLayout } from '@/hooks/useProjectLayout';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  LogOut,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

const boardIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  NOTICE: Megaphone,
  GUIDE: BookOpen,
  QNA: HelpCircle,
  ALLOCATION: BarChart3,
  BUG: Bug,
  CUSTOM: MessageSquare,
};

function ProjectSidebar({ project, boards, onLeave }: { project: Project; boards: Board[]; onLeave: () => void }) {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const isProjectHome = location.pathname === `/projects/${id}`;
  const isAdmin = role === 'admin';

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="bg-card">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            {project.name.charAt(0)}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{project.name}</p>
              <p className="text-xs text-muted-foreground">{isAdmin ? '관리자' : '작업자'}</p>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider">게시판</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {boards.map((board) => {
                const Icon = boardIcons[board.type] || MessageSquare;
                const boardPath = board.type === 'NOTICE' ? `/projects/${id}` : `/projects/${id}/boards/${board.id}`;
                const isActive = board.type === 'NOTICE' ? isProjectHome : location.pathname === boardPath;
                return (
                  <SidebarMenuItem key={board.id}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink to={boardPath} end={board.type === 'NOTICE'} className="hover:bg-muted/50" activeClassName="bg-primary/10 text-primary font-medium">
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

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider">관리</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === `/projects/${id}/dm`}>
                  <NavLink to={`/projects/${id}/dm`} className="hover:bg-muted/50" activeClassName="bg-primary/10 text-primary font-medium">
                    <MessageSquare className="h-4 w-4" />
                    {!collapsed && <span>메시지</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === `/projects/${id}/members`}>
                  <NavLink to={`/projects/${id}/members`} className="hover:bg-muted/50" activeClassName="bg-primary/10 text-primary font-medium">
                    <Users className="h-4 w-4" />
                    {!collapsed && <span>팀 멤버</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAdmin && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.pathname === `/projects/${id}/settings`}>
                      <NavLink to={`/projects/${id}/settings`} className="hover:bg-muted/50" activeClassName="bg-primary/10 text-primary font-medium">
                        <Settings className="h-4 w-4" />
                        {!collapsed && <span>설정</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={onLeave} className="hover:bg-destructive/10 text-destructive hover:text-destructive cursor-pointer">
                      <LogOut className="h-4 w-4" />
                      {!collapsed && <span>프로젝트 나가기</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
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
  const { user } = useAuth();
  const { toast } = useToast();
  const { project, boards, loading } = useProjectLayout(id);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const unreadCount = useUnreadNotifications(user?.id);

  const handleLeaveProject = async () => {
    if (!id || !user) return;
    const { error } = await supabase.from('project_admins').delete().eq('project_id', id).eq('admin_id', user.id);
    if (error) {
      toast({ title: '나가기 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '프로젝트에서 나갔습니다' });
      navigate('/projects');
    }
    setLeaveDialogOpen(false);
  };

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
        <ProjectSidebar project={project} boards={boards} onLeave={() => setLeaveDialogOpen(true)} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center gap-2 border-b border-border bg-card px-4">
            <SidebarTrigger />
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="gap-1 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              프로젝트 목록
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="icon" className="relative" onClick={() => navigate('/notifications')}>
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet context={{ project, boards }} />
          </main>
        </div>
      </div>

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>프로젝트 나가기</AlertDialogTitle>
            <AlertDialogDescription>
              "{project.name}" 프로젝트에서 나가시겠습니까? 나간 후에도 프로젝트 목록에서 열람할 수 있으며, 다시 참여할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveProject}>나가기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
