import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuGroup } from '@/components/ui/dropdown-menu';
import { Bell, LogOut, UserX, User, Settings } from 'lucide-react';

interface ProjectsHeaderProps {
  unreadCount: number;
  onDeleteAccountClick: () => void;
}

export default function ProjectsHeader({ unreadCount, onDeleteAccountClick }: ProjectsHeaderProps) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === 'admin';

  return (
    <header className="border-b border-border bg-card">
      <div className="container flex h-14 items-center justify-between">
        <h1 className="text-lg font-bold text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => navigate('/projects')}>바운드포 라벨링</h1>
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
              <Button variant="ghost" size="sm" className="gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm hidden sm:inline">{isAdmin ? '관리자' : '작업자'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
                <p className="text-xs text-muted-foreground">{isAdmin ? '관리자 계정' : '작업자 계정'}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <Settings className="mr-2 h-4 w-4" /> 프로필 설정
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" /> 로그아웃
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-muted-foreground focus:text-destructive focus:bg-destructive/10"
                onClick={onDeleteAccountClick}
              >
                <UserX className="mr-2 h-4 w-4" /> 회원 탈퇴
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
