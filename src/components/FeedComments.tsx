import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, ChevronUp, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { formatDateTime } from '@/lib/formatDate';

const PREVIEW_COUNT = 3;

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
  type: 'post' | 'notice';
  parentId: string;
}

export default function FeedComments({ type, parentId }: FeedCommentsProps) {
  const { user, role } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [showAll, setShowAll] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [parentId, type]);

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

    const authorIds = [...new Set(items.map(c => c.author_id))];
    if (user) authorIds.push(user.id);
    if (authorIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name, email').in('id', authorIds);
      if (profs) {
        setProfiles(prev => {
          const next = { ...prev };
          profs.forEach((p: any) => { next[p.id] = p; });
          return next;
        });
      }
    }
  };

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

  const handleDelete = async (commentId: string) => {
    if (type === 'post') {
      await supabase.from('comments').delete().eq('id', commentId);
    } else {
      await supabase.from('notice_comments').delete().eq('id', commentId);
    }
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasHidden = comments.length > PREVIEW_COUNT;
  const hiddenCount = comments.length - PREVIEW_COUNT;
  const visibleComments = showAll ? comments : comments.slice(-PREVIEW_COUNT);

  const canDelete = (comment: Comment) => {
    return user?.id === comment.author_id || role === 'admin';
  };

  const renderComment = (comment: Comment) => {
    const author = profiles[comment.author_id];
    return (
      <div key={comment.id} className="flex gap-2 group">
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
                {formatDateTime(comment.created_at)}
              </span>
              {canDelete(comment) && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto text-muted-foreground hover:text-destructive"
                  title="삭제"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap break-words overflow-hidden">{comment.body}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      {hasHidden && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronUp className="h-3.5 w-3.5" />
          이전 댓글 {hiddenCount}개 더보기
        </button>
      )}

      <AnimatePresence initial={false}>
        {visibleComments.length > 0 && (
          <div className="space-y-2.5 mb-3">
            {visibleComments.map(renderComment)}
          </div>
        )}
      </AnimatePresence>

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
  );
}
