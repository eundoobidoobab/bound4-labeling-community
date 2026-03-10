import { useEffect, useState, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, Mail, Clock, CheckCircle2, XCircle, Users, Shield, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/formatDate';
import { motion } from 'framer-motion';

interface Project { id: string; name: string; status: string; }
interface Board { id: string; name: string; type: string; order_index: number; status: string; }

interface Member {
  id: string;
  worker_id: string;
  status: string;
  created_at: string;
  display_name: string | null;
  email: string;
}

interface Invitation {
  id: string;
  email: string;
  status: string;
  created_at: string;
  expires_at: string;
}

interface Admin {
  admin_id: string;
  display_name: string | null;
  email: string;
}

interface SearchUser {
  id: string;
  display_name: string | null;
  email: string;
}

export default function MembersPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { project } = useOutletContext<{ project: Project; boards: Board[] }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState<Member[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // User search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, [projectId]);

  const fetchAll = async () => {
    if (!projectId) return;
    setLoading(true);

    const [membersRes, adminsRes, invitationsRes] = await Promise.all([
      supabase.from('project_memberships').select('*').eq('project_id', projectId).eq('status', 'ACTIVE'),
      supabase.from('project_admins').select('admin_id').eq('project_id', projectId),
      supabase.from('project_invitations').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    ]);

    const workerIds = (membersRes.data || []).map((m: any) => m.worker_id);
    const adminIds = (adminsRes.data || []).map((a: any) => a.admin_id);
    const allIds = [...new Set([...workerIds, ...adminIds])];

    let profileMap: Record<string, { display_name: string | null; email: string }> = {};
    if (allIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, email').in('id', allIds);
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
    }

    setMembers((membersRes.data || []).map((m: any) => ({
      ...m,
      display_name: profileMap[m.worker_id]?.display_name || null,
      email: profileMap[m.worker_id]?.email || m.worker_id,
    })));

    setAdmins(adminIds.map((id: string) => ({
      admin_id: id,
      display_name: profileMap[id]?.display_name || null,
      email: profileMap[id]?.email || id,
    })));

    setInvitations((invitationsRes.data || []) as Invitation[]);
    setLoading(false);
  };

  const handleSearchUsers = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);

    // Search profiles by email or display_name
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .or(`email.ilike.%${query.trim()}%,display_name.ilike.%${query.trim()}%`)
      .limit(20);

    if (data) {
      // Filter out users already in the project (admins + active members)
      const existingIds = new Set([
        ...admins.map(a => a.admin_id),
        ...members.map(m => m.worker_id),
      ]);
      // Also filter out users with pending invitations
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

  const handleInviteUser = async (targetUser: SearchUser) => {
    if (!projectId || !user) return;
    setInvitingUserId(targetUser.id);

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
      // Remove from search results
      setSearchResults(prev => prev.filter(u => u.id !== targetUser.id));
      fetchAll();
    }
  };

  const handleInviteByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !projectId || !user) return;
    setInviting(true);

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
      fetchAll();
    }
  };

  const removeMember = async (membershipId: string) => {
    await supabase.from('project_memberships').update({ status: 'REMOVED' }).eq('id', membershipId);
    toast({ title: '멤버가 제거되었습니다' });
    fetchAll();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingInvitations = invitations.filter(inv => inv.status === 'PENDING' && new Date(inv.expires_at) > new Date());

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">팀 멤버</h1>
          <p className="text-sm text-muted-foreground mt-1">프로젝트 참여자를 관리하세요</p>
        </div>
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
                    <div
                      key={u.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                          {(u.display_name || u.email).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {u.display_name || u.email}
                        </p>
                        {u.display_name && (
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleInviteUser(u)}
                        disabled={invitingUserId === u.id}
                      >
                        {invitingUserId === u.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          '초대'
                        )}
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
                      아직 가입하지 않은 사용자도 이메일로 초대할 수 있습니다. 해당 이메일로 가입 후 초대를 수락할 수 있습니다.
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
      </div>

      {/* Admins */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4" /> 관리자 ({admins.length})
        </h2>
        <div className="space-y-2">
          {admins.map((admin, i) => (
            <motion.div key={admin.admin_id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {(admin.display_name || admin.email).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{admin.display_name || admin.email}</p>
                  <p className="text-xs text-muted-foreground">{admin.email}</p>
                </div>
                <Badge variant="secondary" className="text-xs">관리자</Badge>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Members */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" /> 작업자 ({members.length})
        </h2>
        {members.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">아직 참여 중인 작업자가 없습니다</p>
            <p className="text-xs text-muted-foreground mt-1">위의 초대하기 버튼으로 작업자를 초대하세요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member, i) => (
              <motion.div key={member.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card group">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                      {(member.display_name || member.email).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{member.display_name || member.email}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDateTime(member.created_at)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                    onClick={() => removeMember(member.id)}
                  >
                    제거
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <div>
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
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
