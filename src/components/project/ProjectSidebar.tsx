import { useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { Board, Project } from '@/types';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import {
  Megaphone,
  BookOpen,
  HelpCircle,
  BarChart3,
  Bug,
  MessageSquare,
  Users,
  Settings,
  LogOut,
} from 'lucide-react';

const boardIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  NOTICE: Megaphone,
  GUIDE: BookOpen,
  QNA: HelpCircle,
  ALLOCATION: BarChart3,
  BUG: Bug,
  CUSTOM: MessageSquare,
};

interface ProjectSidebarProps {
  project: Project;
  boards: Board[];
  onLeave: () => void;
}

export function ProjectSidebar({ project, boards, onLeave }: ProjectSidebarProps) {
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
