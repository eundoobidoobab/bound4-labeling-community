import { useState, useCallback } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, UserPlus, Mail, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Admin, MemberInvitation } from '@/hooks/useMembersData';

interface SearchUser {
  id: string;
  display_name: string | null;
  email: string;
}

interface InviteMemberDialogProps {
  projectId: string;
  admins: Admin[];
  members: { worker_id: string }[];
  invitations: MemberInvitation[];
  onInvited: () => void;
}

export default function InviteMemberDialog({ projectId, admins, members, invitations, onInvited }: InviteMemberDialogProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  const expirePreviousInvitations = async (email: string) => {
    await supabase.from('project_invitations').update({ status: 'EXPIRED' }).eq('project_id', projectId).eq('email', email.toLowerCase()).eq('status', 'PENDING');
  };

  const handleSearchUsers = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase.rpc('search_profiles_for_invite', { _query: query.trim(), _limit: 20 });
    if (data) {
      const existingIds = new Set([...admins.map(a => a.admin_id), ...members.map(m => m.worker_id)]);
      const pendingEmails = new Set(invitations.filter(inv => inv.status === 'PENDING' && new Date(inv.expires_at) > new Date()).map(inv => inv.email.toLowerCase()));
      setSearchResults(data.filter((u: any) => !existingIds.has(u.id) && !pendingEmails.has(u.email.toLowerCase())));
    }
    setSearching(false);
  }, [admins, members, invitations, projectId]);

  const handleInviteUser = async (targetUser: SearchUser) => {
    setInvitingUserId(targetUser.id);
    await expirePreviousInvitations(targetUser.email);
    const token = crypto.randomUUID();
    const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7);
    const { error } = await supabase.from('project_invitations').insert({ project_id: projectId, email: targetUser.email.toLowerCase(), token, expires_at: expiresAt.toISOString() });
    setInvitingUserId(null);
    if (error) { toast({ title: '초대 실패', description: error.message, variant: 'destructive' }); }
    else { toast({ title: '초대가 전송되었습니다', description: `${targetUser.display_name || targetUser.email}에게 초대를 보냈습니다.` }); setSearchResults(prev => prev.filter(u => u.id !== targetUser.id)); onInvited(); }
  };

  const handleInviteByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    await expirePreviousInvitations(inviteEmail.trim());
    const token = crypto.randomUUID();
    const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7);
    const { error } = await supabase.from('project_invitations').insert({ project_id: projectId, email: inviteEmail.trim().toLowerCase(), token, expires_at: expiresAt.toISOString() });
    setInviting(false);
    if (error) { toast({ title: '초대 실패', description: error.message, variant: 'destructive' }); }
    else { toast({ title: '초대가 전송되었습니다', description: `${inviteEmail}에게 초대를 보냈습니다.` }); setInviteEmail(''); setDialogOpen(false); onInvited(); }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setSearchQuery(''); setSearchResults([]); setInviteEmail(''); } }}>
      <DialogTrigger asChild>
        <Button><UserPlus className="mr-2 h-4 w-4" />초대하기</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>작업자 초대</DialogTitle></DialogHeader>
        <Tabs defaultValue="search" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="search" className="flex-1"><Search className="mr-2 h-4 w-4" />사용자 검색</TabsTrigger>
            <TabsTrigger value="email" className="flex-1"><Mail className="mr-2 h-4 w-4" />이메일 초대</TabsTrigger>
          </TabsList>
          <TabsContent value="search" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>이름 또는 이메일로 검색</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={searchQuery} onChange={(e) => handleSearchUsers(e.target.value)} placeholder="이름 또는 이메일 입력..." className="pl-9" />
              </div>
              <p className="text-xs text-muted-foreground">플랫폼에 가입된 사용자를 검색하여 프로젝트에 초대할 수 있습니다.</p>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {searching && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
              {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && <div className="text-center py-6 text-sm text-muted-foreground">검색 결과가 없습니다</div>}
              {searchResults.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-muted text-muted-foreground">{(u.display_name || u.email).charAt(0).toUpperCase()}</AvatarFallback></Avatar>
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
                <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="worker@example.com" required />
                <p className="text-xs text-muted-foreground">아직 가입하지 않은 사용자도 이메일로 초대할 수 있습니다.</p>
              </div>
              <Button type="submit" className="w-full" disabled={inviting}>
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}초대 보내기
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
