import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { formatDateTime } from '@/lib/formatDate';

const COMMENT_BODY_MAX = 200;
const COMMENTS_PER_PAGE = 10;
const PREVIEW_COUNT = 3;

function CollapsibleComment({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split('\n');
  const needsTruncate = lines.length > 4 || text.length > COMMENT_BODY_MAX;

  if (!needsTruncate) {
    return <p className="text-sm text-foreground whitespace-pre-wrap break-words overflow-hidden">{text}</p>;
  }

  const preview = expanded ? text : lines.slice(0, 4).join('\n').slice(0, COMMENT_BODY_MAX);

  return (
    <div>
      <p className="text-sm text-foreground whitespace-pre-wrap break-words overflow-hidden">
        {preview}{!expanded && '...'}
      </p>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mt-0.5 transition-colors"
      >
        {expanded ? <><ChevronUp className="h-3 w-3" /> 접기</> : <><ChevronDown className="h-3 w-3" /> 더보기</>}
      </button>
    </div>
  );
}

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
  const [totalCount, setTotalCount] = useState(0);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [showAll, setShowAll] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialComments();
  }, [parentId, type]);

  const fetchInitialComments = async () => {
    let total = 0;
    let items: Comment[] = [];

    if (type === 'post') {
      const { count } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', parentId);
      total = count ?? 0;
      const { data } = await supabase.from('comments').select('*').eq('post_id', parentId)
        .order('created_at', { ascending: false }).limit(PREVIEW_COUNT);
      items = ((data || []) as Comment[]).reverse();
    } else {
      const { count } = await supabase.from('notice_comments').select('*', { count: 'exact', head: true }).eq('notice_id', parentId);
      total = count ?? 0;
      const { data } = await supabase.from('notice_comments').select('*').eq('notice_id', parentId)
        .order('created_at', { ascending: false }).limit(PREVIEW_COUNT);
      items = ((data || []) as Comment[]).reverse();
    }

    setTotalCount(total);
    setComments(items);
    setShowAll(total <= PREVIEW_COUNT);

    await fetchProfilesFor(items);
  };

  const loadOlderComments = async () => {
    if (comments.length === 0) return;
    setLoadingMore(true);
    const oldestDate = comments[0].created_at;
    let olderItems: Comment[] = [];

    if (type === 'post') {
      const { data } = await supabase.from('comments').select('*').eq('post_id', parentId)
        .lt('created_at', oldestDate).order('created_at', { ascending: false }).limit(COMMENTS_PER_PAGE);
      olderItems = ((data || []) as Comment[]).reverse();
    } else {
      const { data } = await supabase.from('notice_comments').select('*').eq('notice_id', parentId)
        .lt('created_at', oldestDate).order('created_at', { ascending: false }).limit(COMMENTS_PER_PAGE);
      olderItems = ((data || []) as Comment[]).reverse();
    }
    if (olderItems.length > 0) {
      setComments(prev => [...olderItems, ...prev]);
      await fetchProfilesFor(olderItems);
    }
    if (olderItems.length < COMMENTS_PER_PAGE) {
      setShowAll(true);
    }
    setLoadingMore(false);
  };

  const fetchProfilesFor = async (items: Comment[]) => {
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
    // Re-fetch to get the new comment
    await fetchInitialComments();
  };

  const handleDelete = async (commentId: string) => {
    if (type === 'post') {
      await supabase.from('comments').delete().eq('id', commentId);
    } else {
      await supabase.from('notice_comments').delete().eq('id', commentId);
    }
    setComments(prev => prev.filter(c => c.id !== commentId));
    setTotalCount(prev => prev - 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hiddenCount = totalCount - comments.length;

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
            <CollapsibleComment text={comment.body} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      {hiddenCount > 0 && (
        <button
          onClick={loadOlderComments}
          disabled={loadingMore}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          {loadingMore ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 불러오는 중...</>
          ) : (
            <><ChevronUp className="h-3.5 w-3.5" /> 이전 댓글 {hiddenCount}개 더보기</>
          )}
        </button>
      )}

      <AnimatePresence initial={false}>
        {comments.length > 0 && (
          <div className="space-y-2.5 mb-3">
            {comments.map(renderComment)}
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
