import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Loader2, MessageSquare } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface EligibleUser {
  id: string;
  display_name: string | null;
  email: string;
  custom_role?: string | null;
}

interface NewConversationDialogProps {
  projectId: string;
  existingThreads: { id: string; admin_id: string; worker_id: string }[];
  onThreadCreated: (threadId: string) => void;
}

export default function NewConversationDialog({ projectId, existingThreads, onThreadCreated }: NewConversationDialogProps) {
  const { user, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<EligibleUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);

  const fetchEligibleUsers = useCallback(async () => {
    if (!user || !projectId) return;
    setLoading(true);

    const isAdmin = role === 'admin';
    let eligible: EligibleUser[] = [];

    try {
      if (isAdmin) {
        const { data: memberships } = await supabase
          .from('project_memberships')
          .select('worker_id')
          .eq('project_id', projectId)
          .eq('status', 'ACTIVE');

        const workerIds = (memberships || []).map(m => m.worker_id).filter(id => id !== user.id);

        if (workerIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .in('id', workerIds);
          eligible = (profiles || []) as EligibleUser[];
        }
      } else {
        const { data: adminRows } = await supabase
          .from('project_admins')
          .select('admin_id, custom_role')
          .eq('project_id', projectId);

        const adminIds = (adminRows || []).map(a => a.admin_id).filter(id => id !== user.id);
        const roleMap: Record<string, string | null> = {};
        (adminRows || []).forEach(a => { roleMap[a.admin_id] = a.custom_role; });

        if (adminIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name, email')
            .in('id', adminIds);
          eligible = (profiles || []).map(p => ({ ...p, custom_role: roleMap[p.id] || null })) as EligibleUser[];
        }
      }
    } catch (e) {
      console.error('Failed to fetch eligible users', e);
    }

    setUsers(eligible);
    setLoading(false);
  }, [user, role, projectId]);

  useEffect(() => {
    if (open) {
      fetchEligibleUsers();
    }
  }, [open, fetchEligibleUsers]);

  const getExistingThreadId = useCallback((otherId: string) => {
    const isAdmin = role === 'admin';
    const thread = existingThreads.find(t =>
      isAdmin
        ? (t.admin_id === user?.id && t.worker_id === otherId)
        : (t.worker_id === user?.id && t.admin_id === otherId)
    );
    return thread?.id;
  }, [existingThreads, user?.id, role]);

  const handleSelect = async (other: EligibleUser) => {
    if (!user) return;

    const existingId = getExistingThreadId(other.id);
    if (existingId) {
      setOpen(false);
      onThreadCreated(existingId);
      return;
    }

    setCreating(other.id);
    const isAdmin = role === 'admin';
    const adminId = isAdmin ? user.id : other.id;
    const workerId = isAdmin ? other.id : user.id;

    const { data, error } = await supabase
      .from('dm_threads')
      .insert({ project_id: projectId, admin_id: adminId, worker_id: workerId })
      .select('id')
      .single();

    setCreating(null);

    if (error) {
      toast({ title: '대화 생성 실패', description: error.message, variant: 'destructive' });
      return;
    }

    setOpen(false);
    onThreadCreated(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="새 대화">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            새 대화
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[360px]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              대화 가능한 멤버가 없습니다
            </p>
          ) : (
            <div className="space-y-1">
              {users.map(u => {
                const existingId = getExistingThreadId(u.id);
                const isCreating = creating === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => handleSelect(u)}
                    disabled={isCreating}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-sm bg-primary/10 text-primary">
                        {(u.display_name || u.email).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {u.display_name || u.email.split('@')[0]}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {role === 'admin' ? '작업자' : (u.custom_role || '관리자')}
                      </p>
                    </div>
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                    ) : existingId ? (
                      <span className="text-[11px] text-muted-foreground shrink-0">기존 대화</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
