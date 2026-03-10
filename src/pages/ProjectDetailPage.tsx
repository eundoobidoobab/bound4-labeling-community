import { useEffect, useState } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';
import { Loader2, Pin, Eye, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import FeedComposer from '@/components/FeedComposer';
import FeedAttachments from '@/components/FeedAttachments';

interface Notice {
  id: string;
  title: string;
  body: string;
  created_at: string;
  created_by: string;
  status: string;
  is_pinned: boolean;
  board_id: string;
}

interface Attachment {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
}

interface ReadInfo {
  user_id: string;
  read_at: string;
  display_name: string | null;
  email: string;
}

interface Project { id: string; name: string; status: string; }
interface Board { id: string; name: string; type: string; order_index: number; status: string; }

export default function ProjectDetailPage() {
  const { project, boards } = useOutletContext<{ project: Project; boards: Board[] }>();
  const { id: projectId } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const { toast } = useToast();

  const [notices, setNotices] = useState<Notice[]>([]);
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
  const [profiles, setProfiles] = useState<Record<string, { id: string; display_name: string | null; email: string }>>({});
  const [loading, setLoading] = useState(true);

  // Read tracking modal
  const [readModalOpen, setReadModalOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [readUsers, setReadUsers] = useState<ReadInfo[]>([]);
  const [allMembers, setAllMembers] = useState<{ id: string; display_name: string | null; email: string }[]>([]);
  const [readTab, setReadTab] = useState('all');

  const noticeBoard = boards.find((b) => b.type === 'NOTICE');
  const userProfile = user ? profiles[user.id] : null;
  const userDisplayName = userProfile?.display_name || userProfile?.email || user?.email || 'User';

  useEffect(() => {
    if (!noticeBoard) { setLoading(false); return; }
    fetchNotices();
  }, [noticeBoard]);

  // Fetch current user profile
  useEffect(() => {
    if (user) fetchProfiles([user.id]);
  }, [user]);

  const fetchProfiles = async (ids: string[]) => {
    const missing = ids.filter(id => !profiles[id]);
    if (missing.length === 0) return;
    const { data } = await supabase.from('profiles').select('id, display_name, email').in('id', missing);
    if (data) setProfiles(prev => { const n = { ...prev }; data.forEach((p: any) => { n[p.id] = p; }); return n; });
  };

  const fetchNotices = async () => {
    if (!noticeBoard) return;
    const { data } = await supabase.from('notices').select('*').eq('board_id', noticeBoard.id).eq('status', 'ACTIVE')
      .order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    const items = (data || []) as Notice[];
    setNotices(items);
    setLoading(false);

    if (items.length > 0) {
      // Fetch attachments
      const { data: atts } = await supabase.from('notice_attachments').select('*').in('notice_id', items.map(n => n.id));
      const map: Record<string, Attachment[]> = {};
      (atts || []).forEach((a: any) => { (map[a.notice_id] = map[a.notice_id] || []).push(a); });
      setAttachments(map);

      // Fetch author profiles
      await fetchProfiles([...new Set(items.map(n => n.created_by))]);
    }

    // Mark as read
    if (user && items.length > 0) {
      const noticeIds = items.map(n => n.id);
      const { data: existing } = await supabase.from('notice_reads').select('notice_id').eq('user_id', user.id).in('notice_id', noticeIds);
      const readSet = new Set((existing || []).map((r: any) => r.notice_id));
      const unread = noticeIds.filter(id => !readSet.has(id));
      if (unread.length > 0) {
        await supabase.from('notice_reads').insert(unread.map(notice_id => ({ notice_id, user_id: user.id })));
      }
    }
  };

  const handleCreate = async ({ title, body, attachmentPaths }: { title: string; body: string; attachmentPaths: any[] }) => {
    if (!user || !noticeBoard) return;
    const { data: inserted, error } = await supabase.from('notices').insert({ board_id: noticeBoard.id, title, body, created_by: user.id }).select().single();
    if (error) { toast({ title: '생성 실패', description: error.message, variant: 'destructive' }); return; }
    if (attachmentPaths.length > 0 && inserted) {
      await supabase.from('notice_attachments').insert(attachmentPaths.map(a => ({ ...a, notice_id: inserted.id })));
    }
    toast({ title: '공지사항이 등록되었습니다' });
    fetchNotices();
  };

  const togglePin = async (notice: Notice) => {
    await supabase.from('notices').update({ is_pinned: !notice.is_pinned }).eq('id', notice.id);
    fetchNotices();
  };

  const openReadModal = async (notice: Notice) => {
    setSelectedNotice(notice);
    setReadModalOpen(true);
    setReadTab('all');
    const { data: reads } = await supabase.from('notice_reads').select('user_id, read_at').eq('notice_id', notice.id);
    const [membersRes, adminsRes] = await Promise.all([
      supabase.from('project_memberships').select('worker_id').eq('project_id', projectId!).eq('status', 'ACTIVE'),
      supabase.from('project_admins').select('admin_id').eq('project_id', projectId!),
    ]);
    const memberIds = [...new Set([...(membersRes.data || []).map((m: any) => m.worker_id), ...(adminsRes.data || []).map((a: any) => a.admin_id)])];
    const { data: memberProfiles } = await supabase.from('profiles').select('id, display_name, email').in('id', memberIds);
    const profileMap = new Map((memberProfiles || []).map((p: any) => [p.id, p]));
    setAllMembers((memberProfiles || []) as any[]);
    setReadUsers((reads || []).map((r: any) => {
      const p = profileMap.get(r.user_id);
      return { user_id: r.user_id, read_at: r.read_at, display_name: p?.display_name || null, email: p?.email || r.user_id };
    }));
  };

  const pinnedNotices = notices.filter(n => n.is_pinned);
  const readUserIds = new Set(readUsers.map(r => r.user_id));
  const unreadMembers = allMembers.filter(m => !readUserIds.has(m.id));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">공지사항</h1>
        <p className="text-sm text-muted-foreground mt-1">중요한 공지사항을 확인하세요</p>
      </div>

      {/* Inline composer for admins */}
      {role === 'admin' && (
        <div className="mb-6">
          <FeedComposer
            userDisplayName={userDisplayName}
            placeholder="공지사항을 작성하세요..."
            titlePlaceholder="공지 제목"
            onSubmit={handleCreate}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Pinned summary */}
          {pinnedNotices.length > 0 && (
            <div className="mb-6 rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">고정글</h2>
              <div className="space-y-2">
                {pinnedNotices.map(notice => (
                  <div key={notice.id} className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary transition-colors"
                    onClick={() => document.getElementById(`notice-${notice.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                    <Pin className="h-3 w-3 text-destructive shrink-0" />
                    <span className="text-xs font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">고정</span>
                    <span className="truncate text-foreground">{notice.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notice feed */}
          <div className="space-y-4">
            {notices.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">등록된 공지사항이 없습니다</p>
            ) : (
              notices.map((notice, i) => {
                const author = profiles[notice.created_by];
                return (
                  <motion.div key={notice.id} id={`notice-${notice.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                    <Card className={notice.is_pinned ? 'border-primary/30 bg-primary/5' : ''}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {(author?.display_name || author?.email || '?').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground">{author?.display_name || author?.email || '알 수 없음'}</span>
                                <span className="text-xs text-muted-foreground">{new Date(notice.created_at).toLocaleDateString('ko-KR')}</span>
                                {notice.is_pinned && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                                    <Pin className="h-3 w-3" /> 고정
                                  </span>
                                )}
                              </div>
                              <CardTitle className="text-base mt-1">{notice.title}</CardTitle>
                            </div>
                          </div>
                          {role === 'admin' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => togglePin(notice)}>
                                  <Pin className="mr-2 h-4 w-4" />{notice.is_pinned ? '고정 해제' : '고정'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openReadModal(notice)}>
                                  <Eye className="mr-2 h-4 w-4" />확인율 보기
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pl-16">
                        <p className="text-sm text-foreground whitespace-pre-wrap">{notice.body}</p>
                        <FeedAttachments attachments={attachments[notice.id] || []} />
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Read tracking modal */}
      <Dialog open={readModalOpen} onOpenChange={setReadModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>확인율</DialogTitle></DialogHeader>
          {selectedNotice && (
            <div>
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{allMembers.length > 0 ? `${Math.round((readUsers.length / allMembers.length) * 100)}% 읽음` : '0% 읽음'}</span>
                  <span className="text-muted-foreground">{readUsers.length}/{allMembers.length}명</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: allMembers.length > 0 ? `${(readUsers.length / allMembers.length) * 100}%` : '0%' }} />
                </div>
              </div>
              <Tabs value={readTab} onValueChange={setReadTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="all" className="flex-1">모두 ({allMembers.length})</TabsTrigger>
                  <TabsTrigger value="read" className="flex-1">읽음 ({readUsers.length})</TabsTrigger>
                  <TabsTrigger value="unread" className="flex-1">안읽음 ({unreadMembers.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="mt-3 max-h-64 overflow-y-auto space-y-2">
                  {allMembers.map(m => <MemberRow key={m.id} name={m.display_name || m.email} email={m.email} isRead={readUserIds.has(m.id)} />)}
                </TabsContent>
                <TabsContent value="read" className="mt-3 max-h-64 overflow-y-auto space-y-2">
                  {readUsers.map(r => <MemberRow key={r.user_id} name={r.display_name || r.email} email={r.email} isRead />)}
                </TabsContent>
                <TabsContent value="unread" className="mt-3 max-h-64 overflow-y-auto space-y-2">
                  {unreadMembers.map(m => <MemberRow key={m.id} name={m.display_name || m.email} email={m.email} isRead={false} />)}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberRow({ name, email, isRead }: { name: string; email: string; isRead: boolean }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs bg-primary/10 text-primary">{name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{email}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full ${isRead ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
        {isRead ? '읽음' : '안읽음'}
      </span>
    </div>
  );
}
