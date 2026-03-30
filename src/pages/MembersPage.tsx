import { useState, useCallback } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus, Mail, Clock, Users, Shield, Search, Pencil, Check, X, MessageSquare, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/formatDate';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useMembersData, type Member, type Admin, type MemberInvitation } from '@/hooks/useMembersData';

import type { Project, Board } from '@/types';

interface SearchUser {
  id: string;
  display_name: string | null;
  email: string;
}

type RoleFilter = 'all' | 'admin' | 'worker';

export default function MembersPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { project } = useOutletContext<{ project: Project; boards: Board[] }>();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useMembersData(projectId);
  const members = data?.members ?? [];
  const admins = data?.admins ?? [];
  const invitations = data?.invitations ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['members', projectId] });

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [editRoleValue, setEditRoleValue] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [roleChangeTarget, setRoleChangeTarget] = useState<{ userId: string; name: string; toRole: 'admin' | 'worker' } | null>(null);
  const [changingRole, setChangingRole] = useState(false);

  const handleSearchUsers = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);

    const { data } = await supabase
      .rpc('search_profiles_for_invite', { _query: query.trim(), _limit: 20 });

    if (data) {
      const existingIds = new Set([
        ...admins.map(a => a.admin_id),
        ...members.map(m => m.worker_id),
      ]);
      const pendingEmails = new Set(
        invitations
          .filter(inv => inv.status === 'PENDING' && new Date(inv.expires_at) > new Date())
          .map(inv => inv.email.toLowerCase())
      );
      setSearchResults(
        data.filter((u: any) => !existingIds.has(u.id) && !pendingEmails.has(u.email.toLowerCase()))
      );
    }
    setSearching(false);
  }, [admins, members, invitations]);

  const expirePreviousInvitations = async (email: string) => {
    await supabase
      .from('project_invitations')
      .update({ status: 'EXPIRED' })
      .eq('project_id', projectId!)
      .eq('email', email.toLowerCase())
      .eq('status', 'PENDING');
  };

  const handleInviteUser = async (targetUser: SearchUser) => {
    if (!projectId || !user) return;
    setInvitingUserId(targetUser.id);

    await expirePreviousInvitations(targetUser.email);

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error } = await supabase.from('project_invitations').insert({
      project_id: projectId,
      email: targetUser.email.toLowerCase(),
      token,
      expires_at: expiresAt.toISOString(),
    });

    setInvitingUserId(null);
    if (error) {
      toast({ title: '초대 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '초대가 전송되었습니다', description: `${targetUser.display_name || targetUser.email}에게 초대를 보냈습니다.` });
      setSearchResults(prev => prev.filter(u => u.id !== targetUser.id));
      invalidate();
    }
  };

  const handleInviteByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !projectId || !user) return;
    setInviting(true);

    await expirePreviousInvitations(inviteEmail.trim());
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error } = await supabase.from('project_invitations').insert({
      project_id: projectId,
      email: inviteEmail.trim().toLowerCase(),
      token,
      expires_at: expiresAt.toISOString(),
    });

    setInviting(false);
    if (error) {
      toast({ title: '초대 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '초대가 전송되었습니다', description: `${inviteEmail}에게 초대를 보냈습니다.` });
      setInviteEmail('');
      setDialogOpen(false);
      invalidate();
    }
  };

  const removeMember = async (membershipId: string) => {
    await supabase.from('project_memberships').update({ status: 'REMOVED' }).eq('id', membershipId);
    toast({ title: '멤버가 제거되었습니다' });
    invalidate();
  };

  const startEditRole = (admin: Admin) => {
    setEditingAdminId(admin.id);
    setEditRoleValue(admin.custom_role || '');
  };

  const saveCustomRole = async (adminRowId: string) => {
    const { error } = await supabase
      .from('project_admins')
      .update({ custom_role: editRoleValue.trim() || null } as any)
      .eq('id', adminRowId);

    if (error) {
      toast({ title: '역할 수정 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '역할이 수정되었습니다' });
      invalidate();
    }
    setEditingAdminId(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingInvitations = invitations.filter(inv => inv.status === 'PENDING' && new Date(inv.expires_at) > new Date());

  type UnifiedMember = {
    key: string;
    userId: string;
    display_name: string | null;
    email: string;
    roleLabel: string;
    isAdmin: boolean;
    adminRowId?: string;
    customRole: string | null;
    membershipId?: string;
    joinedAt: string | null;
  };

  const allMembers: UnifiedMember[] = [
    ...admins.map(a => ({
      key: `admin-${a.admin_id}`,
      userId: a.admin_id,
      display_name: a.display_name,
      email: a.email,
      roleLabel: a.custom_role || '관리자',
      isAdmin: true,
      adminRowId: a.id,
      customRole: a.custom_role,
      membershipId: undefined,
      joinedAt: null,
    })),
    ...members.map(m => ({
      key: `member-${m.worker_id}`,
      userId: m.worker_id,
      display_name: m.display_name,
      email: m.email,
      roleLabel: '작업자',
      isAdmin: false,
      adminRowId: undefined,
      customRole: null,
      membershipId: m.id,
      joinedAt: m.created_at,
    })),
  ];

  const isCurrentUserAdmin = admins.some(a => a.admin_id === user?.id);
  const visibleMembers = isCurrentUserAdmin ? allMembers : allMembers.filter(m => m.isAdmin);

  const filteredMembers = isCurrentUserAdmin
    ? (roleFilter === 'all'
        ? visibleMembers
        : roleFilter === 'admin'
          ? visibleMembers.filter(m => m.isAdmin)
          : visibleMembers.filter(m => !m.isAdmin))
    : visibleMembers;

  const handleCancelInvitation = async (invitationId: string) => {
    const { error } = await supabase
      .from('project_invitations')
      .update({ status: 'EXPIRED' })
      .eq('id', invitationId);

    if (error) {
      toast({ title: '초대 취소 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '초대가 취소되었습니다' });
      invalidate();
    }
  };

  const handleChangeRole = async () => {
    if (!roleChangeTarget) return;
    setChangingRole(true);
    const { error } = await supabase.rpc('change_user_role', {
      _target_user_id: roleChangeTarget.userId,
      _new_role: roleChangeTarget.toRole,
      _project_id: projectId!,
    });
    setChangingRole(false);
    setRoleChangeTarget(null);
    if (error) {
      toast({ title: '역할 변경 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '역할이 변경되었습니다', description: `${roleChangeTarget.name}님이 ${roleChangeTarget.toRole === 'admin' ? '관리자' : '작업자'}로 변경되었습니다.` });
      invalidate();
    }
  };

  const handleStartDm = async (targetUserId: string, targetIsAdmin: boolean) => {
    if (!projectId || !user) return;

    // Determine admin_id and worker_id based on who is initiating
    const adminId = targetIsAdmin ? targetUserId : user.id;
    const workerId = targetIsAdmin ? user.id : targetUserId;

    const { data: existing } = await supabase
      .from('dm_threads')
      .select('id')
      .eq('project_id', projectId)
      .eq('admin_id', adminId)
      .eq('worker_id', workerId)
      .maybeSingle();

    if (existing) {
      navigate(`/projects/${projectId}/dm?thread=${existing.id}`);
      return;
    }

    const { data: newThread, error } = await supabase
      .from('dm_threads')
      .insert({ project_id: projectId, admin_id: adminId, worker_id: workerId })
      .select('id')
      .single();

    if (error) {
      toast({ title: 'DM 생성 실패', description: error.message, variant: 'destructive' });
    } else if (newThread) {
      navigate(`/projects/${projectId}/dm?thread=${newThread.id}`);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            구성원 목록
          </h1>
        </div>
        {isCurrentUserAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setSearchQuery('');
              setSearchResults([]);
              setInviteEmail('');
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                초대하기
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>작업자 초대</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="search" className="mt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="search" className="flex-1">
                    <Search className="mr-2 h-4 w-4" />
                    사용자 검색
                  </TabsTrigger>
                  <TabsTrigger value="email" className="flex-1">
                    <Mail className="mr-2 h-4 w-4" />
                    이메일 초대
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="search" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>이름 또는 이메일로 검색</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => handleSearchUsers(e.target.value)}
                        placeholder="이름 또는 이메일 입력..."
                        className="pl-9"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      플랫폼에 가입된 사용자를 검색하여 프로젝트에 초대할 수 있습니다.
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {searching && (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                      <div className="text-center py-6 text-sm text-muted-foreground">
                        검색 결과가 없습니다
                      </div>
                    )}
                    {searchResults.map((u) => (
                      <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                            {(u.display_name || u.email).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{u.display_name || u.email}</p>
                          {u.display_name && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleInviteUser(u)} disabled={invitingUserId === u.id}>
                          {invitingUserId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : '초대'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="email" className="space-y-4 mt-4">
                  <form onSubmit={handleInviteByEmail} className="space-y-4">
                    <div className="space-y-2">
                      <Label>이메일 주소</Label>
                      <Input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="worker@example.com"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        아직 가입하지 않은 사용자도 이메일로 초대할 수 있습니다.
                      </p>
                    </div>
                    <Button type="submit" className="w-full" disabled={inviting}>
                      {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      초대 보내기
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Tab header */}
      <div className="mb-4 flex items-center justify-between border-b border-border">
        <button className="px-4 py-2.5 text-sm font-medium border-b-2 border-primary text-foreground -mb-px">
          {isCurrentUserAdmin ? `전체 구성원 ${allMembers.length}` : `관리자 ${filteredMembers.length}`}
        </button>
      </div>

      {/* Role filter - admin only */}
      {isCurrentUserAdmin && (
        <div className="mb-4">
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="admin">관리자</SelectItem>
              <SelectItem value="worker">작업자</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Members table - desktop */}
      <div className="hidden md:block border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_100px_160px_40px] items-center gap-2 px-4 py-2.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
          <span>이름</span>
          <span>역할</span>
          <span>권한</span>
          <span>참여일</span>
          <span></span>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            해당하는 구성원이 없습니다
          </div>
        ) : (
          filteredMembers.map((m, i) => (
            <motion.div
              key={m.key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="grid grid-cols-[1fr_120px_100px_160px_40px] items-center gap-2 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors group"
            >
              {/* Name */}
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className={`text-xs ${m.isAdmin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {(m.display_name || m.email).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.display_name || m.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
              </div>

              {/* Role */}
              <div className="flex items-center gap-1">
                {m.isAdmin && editingAdminId === m.adminRowId ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editRoleValue}
                      onChange={(e) => setEditRoleValue(e.target.value)}
                      placeholder="예: PM"
                      className="h-7 text-xs w-20"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveCustomRole(m.adminRowId!);
                        if (e.key === 'Escape') setEditingAdminId(null);
                      }}
                      autoFocus
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => saveCustomRole(m.adminRowId!)}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingAdminId(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Badge
                      variant={m.isAdmin ? 'default' : 'secondary'}
                      className={`text-xs ${m.isAdmin ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-primary/10 text-primary hover:bg-primary/10'}`}
                    >
                      {m.roleLabel}
                    </Badge>
                    {m.isAdmin && isCurrentUserAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => startEditRole({ id: m.adminRowId!, admin_id: m.userId, display_name: m.display_name, email: m.email, custom_role: m.customRole })}
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    )}
                  </>
                )}
              </div>

              {/* Permission */}
              <div>
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {m.isAdmin ? '관리자' : '참여자'}
                </Badge>
              </div>

              {/* Joined date */}
              <div className="text-xs text-muted-foreground">
                {m.joinedAt ? formatDateTime(m.joinedAt) : '-'}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-1">
                {/* Worker → Admin DM */}
                {!isCurrentUserAdmin && m.isAdmin && m.userId !== user?.id && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="메시지 보내기" onClick={() => handleStartDm(m.userId, true)}>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
                {/* Admin → Worker DM */}
                {isCurrentUserAdmin && !m.isAdmin && m.userId !== user?.id && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="메시지 보내기" onClick={() => handleStartDm(m.userId, false)}>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
                {/* Role change - admin only, not self */}
                {role === 'admin' && m.userId !== user?.id && (
                  m.isAdmin ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      title="작업자로 변경"
                      onClick={() => setRoleChangeTarget({ userId: m.userId, name: m.display_name || m.email, toRole: 'worker' })}
                    >
                      <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      title="관리자로 승격"
                      onClick={() => setRoleChangeTarget({ userId: m.userId, name: m.display_name || m.email, toRole: 'admin' })}
                    >
                      <ArrowUpCircle className="h-4 w-4 text-primary" />
                    </Button>
                  )
                )}
                {!m.isAdmin && isCurrentUserAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                    onClick={() => removeMember(m.membershipId!)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Members cards - mobile */}
      <div className="md:hidden space-y-3">
        {filteredMembers.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            해당하는 구성원이 없습니다
          </div>
        ) : (
          filteredMembers.map((m, i) => (
            <motion.div
              key={m.key}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="rounded-lg border border-border p-4 bg-card"
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className={`text-xs ${m.isAdmin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {(m.display_name || m.email).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.display_name || m.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge
                      variant={m.isAdmin ? 'default' : 'secondary'}
                      className={`text-xs ${m.isAdmin ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-primary/10 text-primary hover:bg-primary/10'}`}
                    >
                      {m.roleLabel}
                    </Badge>
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {m.isAdmin ? '관리자' : '참여자'}
                    </Badge>
                    {m.joinedAt && (
                      <span className="text-[10px] text-muted-foreground">{formatDateTime(m.joinedAt)}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!isCurrentUserAdmin && m.isAdmin && m.userId !== user?.id && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStartDm(m.userId, true)}>
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  {isCurrentUserAdmin && !m.isAdmin && m.userId !== user?.id && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStartDm(m.userId, false)}>
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  {role === 'admin' && m.userId !== user?.id && (
                    m.isAdmin ? (
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="작업자로 변경" onClick={() => setRoleChangeTarget({ userId: m.userId, name: m.display_name || m.email, toRole: 'worker' })}>
                        <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="관리자로 승격" onClick={() => setRoleChangeTarget({ userId: m.userId, name: m.display_name || m.email, toRole: 'admin' })}>
                        <ArrowUpCircle className="h-4 w-4 text-primary" />
                      </Button>
                    )
                  )}
                  {!m.isAdmin && isCurrentUserAdmin && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMember(m.membershipId!)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4" /> 대기 중인 초대 ({pendingInvitations.length})
          </h2>
          <div className="space-y-2">
            {pendingInvitations.map((inv, i) => (
              <motion.div key={inv.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border bg-muted/20">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(inv.created_at)} 초대 · {new Date(inv.expires_at).toLocaleDateString('ko-KR')} 만료
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs text-muted-foreground">대기 중</Badge>
                  {isCurrentUserAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      title="초대 취소"
                      onClick={() => handleCancelInvitation(inv.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Role change confirmation dialog */}
      <AlertDialog open={!!roleChangeTarget} onOpenChange={(open) => !open && setRoleChangeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>역할 변경 확인</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{roleChangeTarget?.name}</span>님을{' '}
              <span className="font-medium text-foreground">
                {roleChangeTarget?.toRole === 'admin' ? '관리자' : '작업자'}
              </span>
              (으)로 변경하시겠습니까?
              {roleChangeTarget?.toRole === 'admin' && (
                <span className="block mt-2 text-destructive">관리자는 시스템 내 모든 프로젝트와 데이터에 접근할 수 있습니다.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changingRole}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleChangeRole} disabled={changingRole}>
              {changingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              변경
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
