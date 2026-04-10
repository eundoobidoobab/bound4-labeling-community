import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { FolderOpen, Loader2, Archive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useProjectsData } from '@/hooks/useProjectsData';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import type { Project } from '@/types';
import ProjectCard from '@/components/projects/ProjectCard';
import InvitationSection from '@/components/projects/InvitationSection';
import ProjectsHeader from '@/components/projects/ProjectsHeader';
import {
  CreateProjectDialog,
  EditProjectDialog,
  ArchiveProjectDialog,
  PermanentDeleteDialog,
  JoinProjectDialog,
  DeleteAccountDialog,
} from '@/components/projects/ProjectDialogs';

export default function ProjectsPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useProjectsData(user?.id, role);
  const projects = data?.projects ?? [];
  const memberCounts = data?.memberCounts ?? {};
  const joinedProjectIds = data?.joinedProjectIds ?? new Set<string>();
  const invitations = data?.invitations ?? [];
  const unreadCount = useUnreadNotifications(user?.id);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [archiveProject, setArchiveProject] = useState<Project | null>(null);
  const [permanentDeleteProject, setPermanentDeleteProject] = useState<Project | null>(null);
  const [joinDialogProject, setJoinDialogProject] = useState<Project | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  const isAdmin = role === 'admin';
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['projects'] });

  const handleCreateProject = async (name: string, description: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('projects')
      .insert({ name, description: description || null, created_by: user.id } as any)
      .select();
    if (error) {
      toast({ title: '프로젝트 생성 실패', description: error.message, variant: 'destructive' });
    } else {
      setCreateDialogOpen(false);
      toast({ title: '프로젝트가 생성되었습니다' });
      invalidate();
      if (data) navigate(`/projects/${data[0].id}`);
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
    setEditDialogOpen(true);
  };

  const handleEditProject = async (name: string, description: string) => {
    if (!editProject) return;
    const { error } = await supabase.from('projects').update({
      name, description: description || null,
    } as any).eq('id', editProject.id);
    if (error) {
      toast({ title: '수정 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '프로젝트가 수정되었습니다' });
      setEditDialogOpen(false);
      invalidate();
    }
  };

  const handleArchiveProject = async () => {
    if (!archiveProject) return;
    const { error } = await supabase.from('projects').update({ status: 'ARCHIVED' }).eq('id', archiveProject.id);
    if (error) {
      toast({ title: '보관 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '프로젝트가 보관되었습니다' });
      invalidate();
    }
    setArchiveProject(null);
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

  const handlePermanentDelete = async () => {
    if (!permanentDeleteProject) return;
    const { error } = await supabase.rpc('delete_project_permanently', { _project_id: permanentDeleteProject.id });
    if (error) {
      toast({ title: '삭제 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '프로젝트가 영구 삭제되었습니다' });
      invalidate();
    }
    setPermanentDeleteProject(null);
  };

  const handleProjectClick = (project: Project) => {
    if (isAdmin && !joinedProjectIds.has(project.id)) {
      setJoinDialogProject(project);
      return;
    }
    navigate(`/projects/${project.id}`);
  };

  const handleJoinProject = async (customRole: string) => {
    if (!joinDialogProject || !user) return;
    const { error } = await supabase.from('project_admins').upsert({
      project_id: joinDialogProject.id, admin_id: user.id, custom_role: customRole || null,
    }, { onConflict: 'project_id,admin_id' });
    if (error) {
      toast({ title: '참여 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '프로젝트에 참여했습니다' });
      const projectId = joinDialogProject.id;
      setJoinDialogProject(null);
      navigate(`/projects/${projectId}`);
      invalidate();
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to delete account');
      await supabase.auth.signOut();
      toast({ title: '회원 탈퇴가 완료되었습니다' });
      navigate('/login');
    } catch (err: any) {
      toast({ title: '탈퇴 실패', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteAccountOpen(false);
    }
  };

  const activeProjects = projects.filter(p => p.status === 'ACTIVE');
  const archivedProjects = projects.filter(p => p.status === 'ARCHIVED');

  return (
    <div className="min-h-screen bg-background">
      <ProjectsHeader unreadCount={unreadCount} onDeleteAccountClick={() => setDeleteAccountOpen(true)} />

      <main className="container py-8">
        <InvitationSection invitations={invitations} acceptingId={acceptingId} onAccept={handleAcceptInvitation} onDecline={handleDeclineInvitation} />

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">프로젝트</h2>
          {isAdmin && <CreateProjectDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSubmit={handleCreateProject} />}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {activeProjects.length === 0 && archivedProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
                <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">{isAdmin ? '프로젝트를 생성해주세요' : '참여 중인 프로젝트가 없습니다'}</p>
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
                      <ProjectCard key={project.id} project={project} index={i} isAdmin={isAdmin} isJoined={joinedProjectIds.has(project.id)} memberCount={memberCounts[project.id] || 0} onClick={handleProjectClick} onEdit={openEditDialog} onArchive={setArchiveProject} onReactivate={handleReactivateProject} />
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
                        <ProjectCard key={project.id} project={project} index={i} isArchived isAdmin={isAdmin} isJoined={joinedProjectIds.has(project.id)} memberCount={memberCounts[project.id] || 0} onClick={handleProjectClick} onEdit={openEditDialog} onArchive={setArchiveProject} onReactivate={handleReactivateProject} onDelete={setPermanentDeleteProject} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      <EditProjectDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} project={editProject} onSubmit={handleEditProject} />
      <ArchiveProjectDialog project={archiveProject} onOpenChange={() => setArchiveProject(null)} onConfirm={handleArchiveProject} />
      <PermanentDeleteDialog project={permanentDeleteProject} onOpenChange={() => setPermanentDeleteProject(null)} onConfirm={handlePermanentDelete} />
      <JoinProjectDialog project={joinDialogProject} onOpenChange={() => setJoinDialogProject(null)} onJoin={handleJoinProject} />
      <DeleteAccountDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen} userEmail={user?.email || ''} isAdmin={isAdmin} onConfirm={handleDeleteAccount} />
    </div>
  );
}
