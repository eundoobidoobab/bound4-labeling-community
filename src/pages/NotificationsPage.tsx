import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNotificationsRealtime } from '@/hooks/useNotificationsRealtime';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowLeft, Bell, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  deep_link: string | null;
  is_read: boolean;
  created_at: string;
  project_id: string | null;
}

const typeLabels: Record<string, string> = {
  ALLOCATION_DISTRIBUTED: '배분 완료',
  DM_NEW_MESSAGE: '새 메시지',
  NOTICE_PUBLISHED: '새 공지',
  GUIDE_UPDATED: '가이드 업데이트',
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) {
      setNotifications(data as Notification[]);
      // Fetch project names for all unique project_ids
      const projectIds = [...new Set(data.map((n: any) => n.project_id).filter(Boolean))] as string[];
      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', projectIds);
        if (projects) {
          const map: Record<string, string> = {};
          projects.forEach((p: any) => { map[p.id] = p.name; });
          setProjectNames(map);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  // Realtime subscription via custom hook
  const handleNewNotification = useCallback((newNotif: Notification) => {
    setNotifications(prev => {
      if (prev.some(n => n.id === newNotif.id)) return prev;
      return [newNotif, ...prev];
    });
  }, []);

  useNotificationsRealtime({
    userId: user?.id,
    onNewNotification: handleNewNotification,
  });

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="flex-1 text-lg font-bold">알림</h1>
          <Button variant="ghost" size="sm" onClick={markAllRead}>
            <Check className="mr-1 h-4 w-4" />
            모두 읽음
          </Button>
        </div>
      </header>

      <main className="container max-w-2xl py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <Bell className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">알림이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n, i) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card
                  className={`cursor-pointer transition-colors ${
                    !n.is_read ? 'border-primary/30 bg-primary/5' : ''
                  }`}
                  onClick={() => {
                    if (!n.is_read) markAsRead(n.id);
                    if (n.deep_link) navigate(n.deep_link);
                  }}
                >
                  <CardContent className="flex items-start gap-3 p-4">
                    <div
                      className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                        n.is_read ? 'bg-transparent' : 'bg-primary'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium text-primary">
                          {typeLabels[n.type] || n.type}
                        </span>
                        {n.project_id && projectNames[n.project_id] && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground font-medium truncate max-w-[120px]">
                              {projectNames[n.project_id]}
                            </span>
                          </>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                          {new Date(n.created_at).toLocaleString('ko-KR')}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">{n.body}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
