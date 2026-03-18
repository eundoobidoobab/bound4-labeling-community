import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { sendNotifications } from '@/lib/notifications';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, MessageSquare, ArrowLeft } from 'lucide-react';
import { formatDateTime } from '@/lib/formatDate';
import { motion } from 'framer-motion';

interface Thread {
  id: string;
  admin_id: string;
  worker_id: string;
  project_id: string;
  created_at: string;
}

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

interface Profile {
  id: string;
  display_name: string | null;
  email: string;
}

export default function DMPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, role } = useAuth();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState('');
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeThreadId = searchParams.get('thread');

  // Fetch threads
  useEffect(() => {
    if (!projectId || !user) return;
    fetchThreads();
  }, [projectId, user]);

  // Fetch messages when thread changes
  useEffect(() => {
    if (activeThreadId) {
      fetchMessages(activeThreadId);
      setMobileShowChat(true);
    }
  }, [activeThreadId]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!activeThreadId) return;
    const channel = supabase
      .channel(`dm-${activeThreadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'dm_messages',
        filter: `thread_id=eq.${activeThreadId}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        // Fetch profile if unknown
        if (!profiles[newMsg.sender_id]) {
          fetchProfiles([newMsg.sender_id]);
        }
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeThreadId]);

  const fetchThreads = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('dm_threads')
      .select('*')
      .eq('project_id', projectId!)
      .order('created_at', { ascending: false });

    const items = (data || []) as Thread[];
    setThreads(items);

    // Fetch all participant profiles
    const ids = new Set<string>();
    items.forEach(t => { ids.add(t.admin_id); ids.add(t.worker_id); });
    if (user) ids.add(user.id);
    await fetchProfiles([...ids]);
    setLoading(false);
  };

  const fetchMessages = async (threadId: string) => {
    const { data } = await supabase
      .from('dm_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    const items = (data || []) as Message[];
    setMessages(items);

    const senderIds = [...new Set(items.map(m => m.sender_id))];
    await fetchProfiles(senderIds);

    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
  };

  const fetchProfiles = async (ids: string[]) => {
    const missing = ids.filter(id => !profiles[id]);
    if (missing.length === 0) return;
    const { data } = await supabase.from('profiles').select('id, display_name, email').in('id', missing);
    if (data) {
      setProfiles(prev => {
        const next = { ...prev };
        data.forEach((p: any) => { next[p.id] = p; });
        return next;
      });
    }
  };

  const handleSend = async () => {
    if (!body.trim() || !activeThreadId || !user || !projectId) return;
    setSending(true);
    const msgBody = body.trim();
    setBody('');
    setSending(false);

    // Optimistic update: show message immediately
    const optimisticMsg: Message = {
      id: crypto.randomUUID(),
      thread_id: activeThreadId,
      sender_id: user.id,
      body: msgBody,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    await supabase.from('dm_messages').insert({
      thread_id: activeThreadId,
      sender_id: user.id,
      body: msgBody,
    });

    // Fire-and-forget notification
    const thread = threads.find(t => t.id === activeThreadId);
    if (thread) {
      const recipientId = user.id === thread.admin_id ? thread.worker_id : thread.admin_id;
      const senderProfile = profiles[user.id];
      const senderName = senderProfile?.display_name || senderProfile?.email || '알 수 없음';
      sendNotifications({
        userIds: [recipientId],
        type: 'DM_NEW_MESSAGE',
        title: `${senderName}님의 새 메시지`,
        body: msgBody.length > 50 ? msgBody.slice(0, 50) + '...' : msgBody,
        projectId,
        deepLink: `/projects/${projectId}/dm?thread=${activeThreadId}`,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectThread = (threadId: string) => {
    setSearchParams({ thread: threadId });
  };

  const getOtherParticipant = (thread: Thread): { profile: Profile | undefined; role: '관리자' | '작업자' } => {
    const isCurrentUserAdmin = user?.id === thread.admin_id;
    const otherId = isCurrentUserAdmin ? thread.worker_id : thread.admin_id;
    return { profile: profiles[otherId], role: isCurrentUserAdmin ? '작업자' : '관리자' };
  };

  const activeThread = threads.find(t => t.id === activeThreadId);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
      {/* Thread list */}
      <div className={`w-80 border-r border-border flex flex-col bg-card shrink-0 ${mobileShowChat && activeThreadId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            메시지
          </h2>
        </div>

        <ScrollArea className="flex-1">
          {threads.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              대화가 없습니다
            </div>
          ) : (
            threads.map(thread => {
              const { profile: other, role: otherRole } = getOtherParticipant(thread);
              const isActive = thread.id === activeThreadId;
              return (
                <button
                  key={thread.id}
                  onClick={() => selectThread(thread.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 border-b border-border ${isActive ? 'bg-primary/5' : ''}`}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="text-sm bg-primary/10 text-primary">
                      {(other?.display_name || '?').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {other?.display_name || '알 수 없음'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {otherRole}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col min-w-0 ${!activeThreadId && !mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
        {!activeThreadId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">대화를 선택하세요</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="h-14 px-4 flex items-center gap-3 border-b border-border bg-card shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8"
                onClick={() => { setMobileShowChat(false); setSearchParams({}); }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {activeThread && (() => {
                const other = getOtherParticipant(activeThread);
                return (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {(other?.display_name || other?.email || '?').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {other?.display_name || other?.email || '알 수 없음'}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-2xl mx-auto">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    대화를 시작하세요
                  </p>
                )}
                {messages.map((msg, i) => {
                  const isMine = msg.sender_id === user?.id;
                  const sender = profiles[msg.sender_id];
                  const showAvatar = !isMine && (i === 0 || messages[i - 1].sender_id !== msg.sender_id);

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isMine && (
                        <div className="w-8 shrink-0">
                          {showAvatar && (
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                                {(sender?.display_name || sender?.email || '?').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      )}
                      <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
                        {showAvatar && !isMine && (
                          <p className="text-xs text-muted-foreground mb-1 ml-1">
                            {sender?.display_name || sender?.email || '알 수 없음'}
                          </p>
                        )}
                        <div
                          className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                            isMine
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted text-foreground rounded-bl-md'
                          }`}
                        >
                          {msg.body}
                        </div>
                        <p className={`text-[10px] text-muted-foreground mt-1 ${isMine ? 'text-right mr-1' : 'ml-1'}`}>
                          {formatDateTime(msg.created_at)}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border bg-card shrink-0">
              <div className="flex gap-2 max-w-2xl mx-auto">
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="메시지를 입력하세요..."
                  rows={1}
                  className="resize-none min-h-[40px] text-sm"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={sending || !body.trim()}
                  className="h-10 w-10 shrink-0"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
