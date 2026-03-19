import { useEffect, useState } from 'react';
import { getProjectMemberIds, sendNotifications } from '@/lib/notifications';
import { useParams, useOutletContext } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { Loader2, Pin } from 'lucide-react';
import { formatDateTime } from '@/lib/formatDate';
import { useToast } from '@/hooks/use-toast';
import FeedComposer from '@/components/FeedComposer';
import { NoticeCard } from '@/components/FeedCards';
import { useProfiles } from '@/hooks/useProfiles';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Notice, Attachment, Project, Board } from '@/types';

interface ReadInfo {
  user_id: string;
  read_at: string;
  display_name: string | null;
  email: string;
}

export default function ProjectDetailPage() {
  const { project, boards } = useOutletContext<{ project: Project; boards: Board[] }>();
  const { id: projectId } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { profiles, fetchProfiles } = useProfiles();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  // Read tracking modal
  const [readModalOpen, setReadModalOpen] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [readUsers, setReadUsers] = useState<ReadInfo[]>([]);
  const [allMembers, setAllMembers] = useState<{ id: string; display_name: string | null; email: string }[]>([]);
  const [readTab, setReadTab] = useState('all');

  const noticeBoard = boards.find((b) => b.type === 'NOTICE');
  const userProfile = user ? profiles[user.id] : null;
  const userDisplayName = userProfile?.display_name || userProfile?.email || user?.email || 'User';

  // Fetch notices with react-query
  const { data: queryData, isLoading } = useQuery({
    queryKey: ['projectDetail', noticeBoard?.id],
    queryFn: async () => {
      if (!noticeBoard) return { notices: [] as Notice[], attachments: {} as Record<string, Attachment[]> };

      const { data } = await supabase.from('notices').select('*').eq('board_id', noticeBoard.id).eq('status', 'ACTIVE')
        .order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
      const items = (data || []) as Notice[];

      let attachmentMap: Record<string, Attachment[]> = {};
      if (items.length > 0) {
        const { data: atts } = await supabase.from('notice_attachments').select('*').in('notice_id', items.map(n => n.id));
        (atts || []).forEach((a: any) => { (attachmentMap[a.notice_id] = attachmentMap[a.notice_id] || []).push(a); });
      }

      return { notices: items, attachments: attachmentMap };
    },
    enabled: !!noticeBoard,
  });

  const notices = queryData?.notices ?? [];
  const attachments = queryData?.attachments ?? {};

  // Fetch profiles & mark as read
  useEffect(() => {
    if (user) fetchProfiles([user.id]);
  }, [user]);

  useEffect(() => {
    if (notices.length > 0) {
      fetchProfiles(notices.map(n => n.created_by));
    }
  }, [notices]);

  useEffect(() => {
    if (!user || notices.length === 0) return;
    const markRead = async () => {
      const noticeIds = notices.map(n => n.id);
      const { data: existing } = await supabase.from('notice_reads').select('notice_id').eq('user_id', user.id).in('notice_id', noticeIds);
      const readSet = new Set((existing || []).map((r: any) => r.notice_id));
      const unread = noticeIds.filter(id => !readSet.has(id));
      if (unread.length > 0) {
        await supabase.from('notice_reads').insert(unread.map(notice_id => ({ notice_id, user_id: user.id })));
      }
    };
    markRead();
  }, [notices, user]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['projectDetail', noticeBoard?.id] });

  const handleCreate = async ({ title, body, attachmentPaths }: { title: string; body: string; attachmentPaths: any[] }) => {
    if (!user || !noticeBoard) return;
    const { data: inserted, error } = await supabase.from('notices').insert({ board_id: noticeBoard.id, title, body, created_by: user.id }).select().single();
    if (error) { toast({ title: '생성 실패', description: error.message, variant: 'destructive' }); return; }
    if (attachmentPaths.length > 0 && inserted) {
      await supabase.from('notice_attachments').insert(attachmentPaths.map(a => ({ ...a, notice_id: inserted.id })));
    }
    if (projectId) {
      const memberIds = await getProjectMemberIds(projectId, [user.id]);
      await sendNotifications({ userIds: memberIds, type: 'NOTICE_PUBLISHED', title: '새 공지사항', body: title, projectId, deepLink: `/projects/${projectId}` });
    }
    toast({ title: '공지사항이 등록되었습니다' });
    invalidate();
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">공지사항</h1>
        <p className="text-sm text-muted-foreground mt-1">중요한 공지사항을 확인하세요</p>
      </div>

      {role === 'admin' && (
        <div className="mb-6">
          <FeedComposer userDisplayName={userDisplayName} placeholder="공지사항을 작성하세요..." titlePlaceholder="공지 제목" onSubmit={handleCreate} />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
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

          <div className="space-y-4">
            {notices.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">등록된 공지사항이 없습니다</p>
            ) : notices.map((notice, i) => (
              <motion.div key={notice.id} id={`notice-${notice.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <NoticeCard
                  notice={notice}
                  author={profiles[notice.created_by]}
                  attachments={attachments[notice.id] || []}
                  isAdmin={role === 'admin'}
                  isEditing={editingId === notice.id}
                  onEdit={() => setEditingId(notice.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={async (title, body) => {
                    await supabase.from('notices').update({ title, body }).eq('id', notice.id);
                    toast({ title: '공지사항이 수정되었습니다' });
                    setEditingId(null);
                    invalidate();
                  }}
                  onDelete={async () => {
                    await supabase.from('notices').delete().eq('id', notice.id);
                    toast({ title: '공지사항이 삭제되었습니다' });
                    invalidate();
                  }}
                  onTogglePin={async () => {
                    await supabase.from('notices').update({ is_pinned: !notice.is_pinned }).eq('id', notice.id);
                    invalidate();
                  }}
                  onViewReads={() => openReadModal(notice)}
                />
              </motion.div>
            ))}
          </div>
        </>
      )}

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
