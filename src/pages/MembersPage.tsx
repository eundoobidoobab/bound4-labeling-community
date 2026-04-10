import { useState } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Users } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useMembersData } from '@/hooks/useMembersData';
import type { Project, Board } from '@/types';
import InviteMemberDialog from '@/components/members/InviteMemberDialog';
import { MemberDesktopRow, MemberMobileCard, type UnifiedMember } from '@/components/members/MemberRow';
import PendingInvitationsList from '@/components/members/PendingInvitationsList';

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

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [roleChangeTarget, setRoleChangeTarget] = useState<{ userId: string; name: string; toRole: 'admin' | 'worker' } | null>(null);
  const [changingRole, setChangingRole] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['members', projectId] });
  const isCurrentUserAdmin = admins.some(a => a.admin_id === user?.id);

  const allMembers: UnifiedMember[] = [
    ...admins.map(a => ({
      key: `admin-${a.admin_id}`, userId: a.admin_id, display_name: a.display_name, email: a.email,
      roleLabel: a.custom_role || '관리자', isAdmin: true, adminRowId: a.id, customRole: a.custom_role,
      membershipId: undefined, joinedAt: null,
    })),
    ...members.map(m => ({
      key: `member-${m.worker_id}`, userId: m.worker_id, display_name: m.display_name, email: m.email,
      roleLabel: '작업자', isAdmin: false, adminRowId: undefined, customRole: null,
      membershipId: m.id, joinedAt: m.created_at,
    })),
  ];

  const visibleMembers = isCurrentUserAdmin ? allMembers : allMembers.filter(m => m.isAdmin);
  const filteredMembers = isCurrentUserAdmin
    ? (roleFilter === 'all' ? visibleMembers : roleFilter === 'admin' ? visibleMembers.filter(m => m.isAdmin) : visibleMembers.filter(m => !m.isAdmin))
    : visibleMembers;

  const removeMember = async (membershipId: string) => {
    await supabase.from('project_memberships').update({ status: 'REMOVED' }).eq('id', membershipId);
    toast({ title: '멤버가 제거되었습니다' });
    invalidate();
  };

  const handleChangeRole = async () => {
    if (!roleChangeTarget) return;
    setChangingRole(true);
    const { error } = await supabase.rpc('change_user_role', { _target_user_id: roleChangeTarget.userId, _new_role: roleChangeTarget.toRole, _project_id: projectId! });
    setChangingRole(false); setRoleChangeTarget(null);
    if (error) { toast({ title: '역할 변경 실패', description: error.message, variant: 'destructive' }); }
    else { toast({ title: '역할이 변경되었습니다', description: `${roleChangeTarget.name}님이 ${roleChangeTarget.toRole === 'admin' ? '관리자' : '작업자'}로 변경되었습니다.` }); invalidate(); }
  };

  const handleStartDm = async (targetUserId: string, targetIsAdmin: boolean) => {
    if (!projectId || !user) return;
    const adminId = targetIsAdmin ? targetUserId : user.id;
    const workerId = targetIsAdmin ? user.id : targetUserId;
    const { data: existing } = await supabase.from('dm_threads').select('id').eq('project_id', projectId).eq('admin_id', adminId).eq('worker_id', workerId).maybeSingle();
    if (existing) { navigate(`/projects/${projectId}/dm?thread=${existing.id}`); return; }
    const { data: newThread, error } = await supabase.from('dm_threads').insert({ project_id: projectId, admin_id: adminId, worker_id: workerId }).select('id').single();
    if (error) { toast({ title: 'DM 생성 실패', description: error.message, variant: 'destructive' }); }
    else if (newThread) { navigate(`/projects/${projectId}/dm?thread=${newThread.id}`); }
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const sharedRowProps = {
    currentUserId: user?.id,
    isCurrentUserAdmin,
    globalRole: role,
    onRemove: removeMember,
    onStartDm: handleStartDm,
    onRoleChange: (userId: string, name: string, toRole: 'admin' | 'worker') => setRoleChangeTarget({ userId, name, toRole }),
    onRoleSaved: invalidate,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
          구성원 목록
        </h1>
        {isCurrentUserAdmin && projectId && (
          <InviteMemberDialog projectId={projectId} admins={admins} members={members} invitations={invitations} onInvited={invalidate} />
        )}
      </div>

      <div className="mb-4 flex items-center justify-between border-b border-border">
        <button className="px-4 py-2.5 text-sm font-medium border-b-2 border-primary text-foreground -mb-px">
          {isCurrentUserAdmin ? `전체 구성원 ${allMembers.length}` : `관리자 ${filteredMembers.length}`}
        </button>
      </div>

      {isCurrentUserAdmin && (
        <div className="mb-4">
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="admin">관리자</SelectItem>
              <SelectItem value="worker">작업자</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_100px_160px_100px] items-center gap-2 px-4 py-2.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
          <span>이름</span><span>역할</span><span>권한</span><span>참여일</span><span></span>
        </div>
        {filteredMembers.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">해당하는 구성원이 없습니다</div>
        ) : (
          filteredMembers.map((m, i) => <MemberDesktopRow key={m.key} member={m} index={i} {...sharedRowProps} />)
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filteredMembers.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">해당하는 구성원이 없습니다</div>
        ) : (
          filteredMembers.map((m, i) => <MemberMobileCard key={m.key} member={m} index={i} {...sharedRowProps} />)
        )}
      </div>

      <PendingInvitationsList invitations={invitations} isAdmin={isCurrentUserAdmin} onCancelled={invalidate} />

      {/* Role change confirmation */}
      <AlertDialog open={!!roleChangeTarget} onOpenChange={(open) => !open && setRoleChangeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>역할 변경 확인</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{roleChangeTarget?.name}</span>님을{' '}
              <span className="font-medium text-foreground">{roleChangeTarget?.toRole === 'admin' ? '관리자' : '작업자'}</span>
              (으)로 변경하시겠습니까?
              {roleChangeTarget?.toRole === 'admin' && (
                <span className="block mt-2 text-destructive">관리자는 시스템 내 모든 프로젝트와 데이터에 접근할 수 있습니다.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changingRole}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleChangeRole} disabled={changingRole}>
              {changingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}변경
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
