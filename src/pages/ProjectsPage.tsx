import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FolderOpen, Loader2, LogOut, Bell, Users, CalendarDays, Mail, MoreHorizontal, Pencil, Archive, RotateCcw, UserX } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
}

interface Invitation {
  id: string;
  project_id: string;
  email: string;
  status: string;
  expires_at: string;
  created_at: string;
  project_name?: string;
}

export default function ProjectsPage() {
  const { user, role, signOut } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
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
  const navigate = useNavigate();
  const { toast } = useToast();

  // Admin join flow
  const isAdmin = role === 'admin';
  const [joinedProjectIds, setJoinedProjectIds] = useState<Set<string>>(new Set());
  const [joinDialogProject, setJoinDialogProject] = useState<Project | null>(null);
  const [joinRole, setJoinRole] = useState('');
  const [joining, setJoining] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    let items = (data || []) as Project[];
    if (!error) {
      if (role !== 'admin') {
        items = items.filter(p => p.status === 'ACTIVE');
      }
      setProjects(items);
    }

    // Fetch member counts
    if (items.length > 0) {
      const ids = items.map(p => p.id);
      const [membersRes, adminsRes] = await Promise.all([
        supabase.from('project_memberships').select('project_id, worker_id').eq('status', 'ACTIVE').in('project_id', ids),
        supabase.from('project_admins').select('project_id, admin_id').in('project_id', ids),
      ]);
      const countMap: Record<string, number> = {};
      ids.forEach(id => {
        const memberUserIds = new Set(
          (membersRes.data || []).filter((r: any) => r.project_id === id).map((r: any) => r.worker_id)
        );
        (adminsRes.data || []).filter((r: any) => r.project_id === id).forEach((r: any) => memberUserIds.add(r.admin_id));
        countMap[id] = memberUserIds.size;
      });
      setMemberCounts(countMap);

      // Track which projects this admin has joined
      if (isAdmin && user) {
        const myAdminProjects = new Set(
          (adminsRes.data || []).filter((r: any) => r.admin_id === user.id).map((r: any) => r.project_id)
        );
        setJoinedProjectIds(myAdminProjects);
      }
    }

    // Fetch pending invitations for current user's email
    const { data: profileData } = await supabase.from('profiles').select('email').eq('id', user!.id).single();
    const userEmail = profileData?.email?.toLowerCase();

    const { data: invData } = userEmail ? await supabase
      .from('project_invitations')
      .select('*')
      .eq('status', 'PENDING')
      .eq('email', userEmail)
      .gt('expires_at', new Date().toISOString()) : { data: null };

    if (invData && invData.length > 0) {
      const projectIds = [...new Set(invData.map((inv: any) => inv.project_id))];
      const { data: projData } = await supabase.from('projects').select('id, name').in('id', projectIds);
      const projMap: Record<string, string> = {};
      (projData || []).forEach((p: any) => { projMap[p.id] = p.name; });

      setInvitations(invData.map((inv: any) => ({
        ...inv,
        project_name: projMap[inv.project_id] || '알 수 없는 프로젝트',
      })));
    } else {
      setInvitations([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !user) return;
    setCreating(true);

    const { error } = await supabase
      .from('projects')
      .insert({
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || null,
        created_by: user.id,
      } as any);

    setCreating(false);
    if (error) {
      toast({ title: '프로젝트 생성 실패', description: error.message, variant: 'destructive' });
    } else {
      setNewProjectName('');
      setNewProjectDesc('');
      setDialogOpen(false);
      toast({ title: '프로젝트가 생성되었습니다' });
      fetchProjects();
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
      fetchProjects();
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    await supabase.from('project_invitations').update({ status: 'EXPIRED' }).eq('id', invitationId);
    toast({ title: '초대를 거절했습니다' });
    fetchProjects();
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
      name: editName.trim(),
      description: editDesc.trim() || null,
    } as any).eq('id', editProject.id);
    setSaving(false);
    if (error) {
      toast({ title: '수정 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '프로젝트가 수정되었습니다' });
      setEditDialogOpen(false);
      fetchProjects();
    }
  };

  const handleArchiveProject = async () => {
    if (!deleteProject) return;
    const { error } = await supabase.from('projects').update({ status: 'ARCHIVED' }).eq('id', deleteProject.id);
    if (error) {
      toast({ title: '보관 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '프로젝트가 보관되었습니다' });
      fetchProjects();
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
      fetchProjects();
    }
  };

  const handleProjectClick = (project: Project) => {
    // Admin who hasn't joined → show join dialog
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
    const { error } = await supabase.from('project_admins').insert({
      project_id: joinDialogProject.id,
      admin_id: user.id,
      custom_role: joinRole.trim() || null,
    });
    setJoining(false);
    if (error) {
      toast({ title: '참여 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '프로젝트에 참여했습니다' });
      setJoinDialogProject(null);
      navigate(`/projects/${joinDialogProject.id}`);
      fetchProjects();
    }
  };

  const renderProjectCard = (project: Project, i: number, isArchived = false) => {
    const isJoined = joinedProjectIds.has(project.id);
    return (
      <motion.div
        key={project.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05 }}
      >
        <Card
          className={`cursor-pointer transition-shadow hover:shadow-md ${isArchived ? 'opacity-70' : ''}`}
          onClick={() => handleProjectClick(project)}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <CardTitle className="text-base truncate">{project.name}</CardTitle>
                {isAdmin && !isJoined && (
                  <Badge variant="outline" className="text-xs shrink-0">미참여</Badge>
                )}
                {isArchived && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">보관됨</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => openEditDialog(project, e as any)}>
                        <Pencil className="mr-2 h-4 w-4" /> 수정
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {isArchived ? (
                        <DropdownMenuItem onClick={(e) => handleReactivateProject(project.id, e as any)}>
                          <RotateCcw className="mr-2 h-4 w-4" /> 활성화
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteProject(project); }}
                        >
                          <Archive className="mr-2 h-4 w-4" /> 보관
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {project.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {new Date(project.created_at).toLocaleDateString('ko-KR')}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {memberCounts[project.id] || 0}명
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between">
          <h1 className="text-lg font-bold text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => navigate('/projects')}>바운드포 라벨링</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/notifications')}>
              <Bell className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {role === 'admin' ? '관리자' : '작업자'}
            </span>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Pending invitations */}
        <AnimatePresence>
          {invitations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6"
            >
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Mail className="h-4 w-4" /> 받은 초대 ({invitations.length})
              </h3>
              <div className="space-y-3">
                {invitations.map((inv) => (
                  <Card key={inv.id} className="border-primary/30 bg-primary/5">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Mail className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          <span className="font-semibold">{inv.project_name}</span> 프로젝트에 초대되었습니다
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(inv.expires_at).toLocaleDateString('ko-KR')} 까지 유효
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => handleDeclineInvitation(inv.id)}>
                          거절
                        </Button>
                        <Button size="sm" onClick={() => handleAcceptInvitation(inv.id)} disabled={acceptingId === inv.id}>
                          {acceptingId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : '수락'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                    <Input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="프로젝트 이름 입력"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>프로젝트 설명</Label>
                    <Textarea
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      placeholder="프로젝트에 대한 간단한 설명을 입력하세요"
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>생성일자</Label>
                    <Input
                      value={new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      disabled
                      className="text-muted-foreground"
                    />
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

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (() => {
          const activeProjects = projects.filter(p => p.status === 'ACTIVE');
          const archivedProjects = projects.filter(p => p.status === 'ARCHIVED');

          return (
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
                      {activeProjects.map((project, i) => renderProjectCard(project, i))}
                    </div>
                  )}

                  {/* Archived projects section - admin only */}
                  {isAdmin && archivedProjects.length > 0 && (
                    <div className="mt-10">
                      <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                        <Archive className="h-4 w-4" /> 보관된 프로젝트 ({archivedProjects.length})
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {archivedProjects.map((project, i) => renderProjectCard(project, i, true))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          );
        })()}
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
              <Input
                value={joinRole}
                onChange={(e) => setJoinRole(e.target.value)}
                placeholder="예: PM, 계약관리, QA 등"
              />
              <p className="text-xs text-muted-foreground">팀 멤버 목록에 표시되는 역할입니다</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setJoinDialogProject(null)}>
                취소
              </Button>
              <Button className="flex-1" onClick={handleJoinProject} disabled={joining}>
                {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                참여하기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
