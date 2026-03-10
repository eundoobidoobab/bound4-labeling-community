import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Comment {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
}

interface Profile {
  id: string;
  display_name: string | null;
  email: string;
}

interface FeedCommentsProps {
  /** 'post' uses comments table, 'notice' uses notice_comments table */
  type: 'post' | 'notice';
  parentId: string;
}

export default function FeedComments({ type, parentId }: FeedCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchComments = async () => {
    let items: Comment[] = [];
    if (type === 'post') {
      const { data } = await supabase.from('comments').select('*').eq('post_id', parentId).order('created_at', { ascending: true });
      items = (data || []) as Comment[];
    } else {
      const { data } = await supabase.from('notice_comments').select('*').eq('notice_id', parentId).order('created_at', { ascending: true });
      items = (data || []) as Comment[];
    }
    setComments(items);
    setLoaded(true);

    // Fetch profiles
    const authorIds = [...new Set(items.map(c => c.author_id))];
    if (user) authorIds.push(user.id);
    const missing = authorIds.filter(id => !profiles[id]);
    if (missing.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name, email').in('id', missing);
      if (profs) {
        setProfiles(prev => {
          const next = { ...prev };
          profs.forEach((p: any) => { next[p.id] = p; });
          return next;
        });
      }
    }
  };

  useEffect(() => {
    if (expanded && !loaded) fetchComments();
  }, [expanded]);

  const handleSubmit = async () => {
    if (!user || !body.trim()) return;
    setSubmitting(true);
    if (type === 'post') {
      await supabase.from('comments').insert({ post_id: parentId, author_id: user.id, body: body.trim() });
    } else {
      await supabase.from('notice_comments').insert({ notice_id: parentId, author_id: user.id, body: body.trim() });
    }
    setBody('');
    setSubmitting(false);
    await fetchComments();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="mt-3">
      <button
        onClick={() => { setExpanded(!expanded); }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {loaded ? `댓글 ${comments.length}개` : '댓글'}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3">
              {/* Existing comments */}
              {comments.map((comment) => {
                const author = profiles[comment.author_id];
                return (
                  <div key={comment.id} className="flex gap-2">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                        {(author?.display_name || author?.email || '?').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="rounded-lg bg-muted/40 px-3 py-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-foreground">
                            {author?.display_name || author?.email || '알 수 없음'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(comment.created_at).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{comment.body}</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Comment input */}
              {user && (
                <div className="flex gap-2">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {(profiles[user.id]?.display_name || profiles[user.id]?.email || user.email || '?').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex gap-2">
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="댓글을 입력하세요..."
                      rows={1}
                      className="resize-none min-h-[36px] text-sm py-2"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 shrink-0"
                      onClick={handleSubmit}
                      disabled={submitting || !body.trim()}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
