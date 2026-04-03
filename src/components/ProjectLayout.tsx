import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toastError } from '@/lib/errorUtils';
import { useProjectLayout } from '@/hooks/useProjectLayout';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { useBoardUnread } from '@/hooks/useBoardUnread';
import { useDMUnread } from '@/hooks/useDMUnread';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { ProjectSidebar } from '@/components/project/ProjectSidebar';
import { LeaveProjectDialog } from '@/components/project/LeaveProjectDialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bell, Loader2, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function ProjectLayout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { project, boards, loading } = useProjectLayout(id);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const unreadCount = useUnreadNotifications(user?.id);
  const { unreadBoardIds, recheckUnread } = useBoardUnread(boards);

  const handleLeaveProject = async () => {
    if (!id || !user) return;
    const { error } = await supabase.from('project_admins').delete().eq('project_id', id).eq('admin_id', user.id);
    if (error) {
      toast(toastError(error, '나가기 실패'));
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
        <ProjectSidebar project={project} boards={boards} onLeave={() => setLeaveDialogOpen(true)} unreadBoardIds={unreadBoardIds} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center gap-2 border-b border-border bg-card px-4">
            <SidebarTrigger />
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="gap-1 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              프로젝트 목록
            </Button>
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="relative" onClick={() => navigate('/notifications')}>
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {user?.user_metadata?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-foreground truncate">{user?.user_metadata?.display_name || '이름 없음'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="h-4 w-4 mr-2" />
                    내 정보
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet context={{ project, boards, recheckUnread }} />
          </main>
        </div>
      </div>

      <LeaveProjectDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        projectName={project.name}
        onConfirm={handleLeaveProject}
      />
    </SidebarProvider>
  );
}
