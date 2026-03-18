import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Plus, FolderOpen, Loader2, LogOut, Bell, Archive, UserX, User, Settings } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuGroup } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useProjectsData } from '@/hooks/useProjectsData';
import type { Project } from '@/types';
import ProjectCard from '@/components/projects/ProjectCard';
import InvitationSection from '@/components/projects/InvitationSection';

export default function ProjectsPage() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useProjectsData(user?.id, role);
  const projects = data?.projects ?? [];
  const memberCounts = data?.memberCounts ?? {};
  const joinedProjectIds = data?.joinedProjectIds ?? new Set<string>();
  const invitations = data?.invitations ?? [];

  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [joinDialogProject, setJoinDialogProject] = useState<Project | null>(null);
  const [joinRole, setJoinRole] = useState('');
  const [joining, setJoining] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = role === 'admin';
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['projects'] });

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !user) return;
    setCreating(true);
    const { error } = await supabase
      .from('projects')
      .insert({ name: newProjectName.trim(), description: newProjectDesc.trim() || null, created_by: user.id } as any);
    setCreating(false);
    if (error) {
      toast({ title: '프로젝트 생성 실패', description: error.message, variant: 'destructive' });
    } else {
      setNewProjectName(''); setNewProjectDesc(''); setDialogOpen(false);
      toast({ title: '프로젝트가 생성되었습니다' });
      invalidate();
    }
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    setAcceptingId(invitationId);
    const { error } = await supabase.rpc('accept_invitation', { _invitation_id: invitationId });
    setAcceptingId(null);
    if (error) {
      toast({ title: '초대 수락 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '초대를 수락했습니다', description: '프로젝트에 참여되었습니다.' });
      invalidate();
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    await supabase.from('project_invitations').update({ status: 'EXPIRED' }).eq('id', invitationId);
    toast({ title: '초대를 거절했습니다' });
    invalidate();
  };

  const openEditDialog = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditProject(project);
    setEditName(project.name);
    setEditDesc(project.description || '');
    setEditDialogOpen(true);
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProject || !editName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('projects').update({
      name: editName.trim(), description: editDesc.trim() || null,
    } as any).eq('id', editProject.id);
    setSaving(false);
    if (error) {
      toast({ title: '수정 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '프로젝트가 수정되었습니다' });
      setEditDialogOpen(false);
      invalidate();
    }
  };

  const handleArchiveProject = async () => {
    if (!deleteProject) return;
    const { error } = await supabase.from('projects').update({ status: 'ARCHIVED' }).eq('id', deleteProject.id);
    if (error) {
      toast({ title: '보관 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '프로젝트가 보관되었습니다' });
      invalidate();
    }
    setDeleteProject(null);
  };

  const handleReactivateProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('projects').update({ status: 'ACTIVE' }).eq('id', projectId);
    if (error) {
      toast({ title: '활성화 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '프로젝트가 다시 활성화되었습니다' });
      invalidate();
    }
  };

  const handleProjectClick = (project: Project) => {
    if (isAdmin && !joinedProjectIds.has(project.id)) {
      setJoinDialogProject(project);
      setJoinRole('');
      return;
    }
    navigate(`/projects/${project.id}`);
  };

  const handleJoinProject = async () => {
    if (!joinDialogProject || !user) return;
    setJoining(true);
    const { error } = await supabase.from('project_admins').upsert({
      project_id: joinDialogProject.id,
      admin_id: user.id,
      custom_role: joinRole.trim() || null,
    }, { onConflict: 'project_id,admin_id' });
    setJoining(false);
    if (error) {
      toast({ title: '참여 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '프로젝트에 참여했습니다' });
      setJoinDialogProject(null);
      navigate(`/projects/${joinDialogProject.id}`);
      invalidate();
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to delete account');
      await supabase.auth.signOut();
      toast({ title: '회원 탈퇴가 완료되었습니다' });
      navigate('/login');
    } catch (err: any) {
      toast({ title: '탈퇴 실패', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteAccountOpen(false);
    }
  };

  const activeProjects = projects.filter(p => p.status === 'ACTIVE');
  const archivedProjects = projects.filter(p => p.status === 'ARCHIVED');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between">
          <h1 className="text-lg font-bold text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => navigate('/projects')}>바운드포 라벨링</h1>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate('/notifications')}>
              <Bell className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm hidden sm:inline">{role === 'admin' ? '관리자' : '작업자'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">{role === 'admin' ? '관리자 계정' : '작업자 계정'}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" /> 로그아웃
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-muted-foreground focus:text-destructive focus:bg-destructive/10"
                  onClick={() => setDeleteAccountOpen(true)}
                >
                  <UserX className="mr-2 h-4 w-4" /> 회원 탈퇴
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <InvitationSection
          invitations={invitations}
          acceptingId={acceptingId}
          onAccept={handleAcceptInvitation}
          onDecline={handleDeclineInvitation}
        />

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">프로젝트</h2>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  새 프로젝트
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>새 프로젝트 생성</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateProject} className="space-y-4">
                  <div className="space-y-2">
                    <Label>프로젝트 이름</Label>
                    <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="프로젝트 이름 입력" required />
                  </div>
                  <div className="space-y-2">
                    <Label>프로젝트 설명</Label>
                    <Textarea value={newProjectDesc} onChange={(e) => setNewProjectDesc(e.target.value)} placeholder="프로젝트에 대한 간단한 설명을 입력하세요" rows={3} className="resize-none" />
                  </div>
                  <div className="space-y-2">
                    <Label>생성일자</Label>
                    <Input value={new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })} disabled className="text-muted-foreground" />
                  </div>
                  <Button type="submit" className="w-full" disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    생성
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {activeProjects.length === 0 && archivedProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
                <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {isAdmin ? '프로젝트를 생성해주세요' : '참여 중인 프로젝트가 없습니다'}
                </p>
              </div>
            ) : (
              <>
                {activeProjects.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 mb-8">
                    <FolderOpen className="mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">활성 프로젝트가 없습니다</p>
                  </div>
                )}
                {activeProjects.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {activeProjects.map((project, i) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        index={i}
                        isAdmin={isAdmin}
                        isJoined={joinedProjectIds.has(project.id)}
                        memberCount={memberCounts[project.id] || 0}
                        onClick={handleProjectClick}
                        onEdit={openEditDialog}
                        onArchive={setDeleteProject}
                        onReactivate={handleReactivateProject}
                      />
                    ))}
                  </div>
                )}

                {isAdmin && archivedProjects.length > 0 && (
                  <div className="mt-10">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                      <Archive className="h-4 w-4" /> 보관된 프로젝트 ({archivedProjects.length})
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {archivedProjects.map((project, i) => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          index={i}
                          isArchived
                          isAdmin={isAdmin}
                          isJoined={joinedProjectIds.has(project.id)}
                          memberCount={memberCounts[project.id] || 0}
                          onClick={handleProjectClick}
                          onEdit={openEditDialog}
                          onArchive={setDeleteProject}
                          onReactivate={handleReactivateProject}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Edit project dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>프로젝트 수정</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditProject} className="space-y-4">
            <div className="space-y-2">
              <Label>프로젝트 이름</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>프로젝트 설명</Label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} className="resize-none" />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              저장
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation */}
      <AlertDialog open={!!deleteProject} onOpenChange={(v) => !v && setDeleteProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>프로젝트 보관</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteProject?.name}" 프로젝트를 보관하시겠습니까? 작업자들은 보관된 프로젝트에 접근할 수 없으며, 관리자만 열람 및 활성화가 가능합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveProject}>보관</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin join project dialog */}
      <Dialog open={!!joinDialogProject} onOpenChange={(v) => !v && setJoinDialogProject(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>프로젝트 참여</DialogTitle>
            <DialogDescription>
              "{joinDialogProject?.name}" 프로젝트에 참여하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>역할 (선택)</Label>
              <Input value={joinRole} onChange={(e) => setJoinRole(e.target.value)} placeholder="예: PM, 계약관리, QA 등" />
              <p className="text-xs text-muted-foreground">팀 멤버 목록에 표시되는 역할입니다</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setJoinDialogProject(null)}>취소</Button>
              <Button className="flex-1" onClick={handleJoinProject} disabled={joining}>
                {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                참여하기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete account confirmation */}
      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>회원 탈퇴</AlertDialogTitle>
            <AlertDialogDescription>
              {isAdmin
                ? '정말 탈퇴하시겠습니까? 관리자 계정은 동일 이메일로 다시 가입할 수 있습니다.'
                : '정말 탈퇴하시겠습니까? 탈퇴 후 재가입 시 새로운 회원으로 처리되며, 기존 데이터는 복구되지 않습니다.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              탈퇴하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
