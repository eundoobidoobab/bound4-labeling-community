import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { useProfiles } from '@/hooks/useProfiles';
import { formatDateTime } from '@/lib/formatDate';
import type { CommentsBundle, CommentPreview } from '@/hooks/useBoardData';

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

interface FeedCommentsProps {
  type: 'post' | 'notice';
  parentId: string;
  /** Initial bundle prefetched by the parent board query */
  initial?: CommentsBundle;
  /** Notify parent after mutation so it can refetch the board query */
  onChanged?: () => void;
}

export default function FeedComments({ type, parentId, initial, onChanged }: FeedCommentsProps) {
  const { user, role } = useAuth();
  const { profiles, fetchProfiles } = useProfiles();
  const [comments, setComments] = useState<CommentPreview[]>(initial?.preview ?? []);
  const [totalCount, setTotalCount] = useState(initial?.total ?? 0);
  const [showAll, setShowAll] = useState((initial?.total ?? 0) <= PREVIEW_COUNT);
  const [loadingMore, setLoadingMore] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Sync when parent bundle changes (board refetch)
  useEffect(() => {
    setComments(initial?.preview ?? []);
    setTotalCount(initial?.total ?? 0);
    setShowAll((initial?.total ?? 0) <= PREVIEW_COUNT);
  }, [initial]);

  // Fetch author + current user profiles (cached centrally via useProfiles)
  useEffect(() => {
    const ids = new Set<string>();
    comments.forEach((c) => ids.add(c.author_id));
    if (user) ids.add(user.id);
    if (ids.size > 0) fetchProfiles([...ids]);
  }, [comments, user]);

  const loadOlderComments = async () => {
    if (comments.length === 0) return;
    setLoadingMore(true);
    const oldestDate = comments[0].created_at;
    let olderItems: CommentPreview[] = [];

    if (type === 'post') {
      const { data } = await supabase.from('comments').select('id, body, author_id, created_at')
        .eq('post_id', parentId)
        .lt('created_at', oldestDate)
        .order('created_at', { ascending: false })
        .limit(COMMENTS_PER_PAGE);
      olderItems = ((data || []) as CommentPreview[]).reverse();
    } else {
      const { data } = await supabase.from('notice_comments').select('id, body, author_id, created_at')
        .eq('notice_id', parentId)
        .lt('created_at', oldestDate)
        .order('created_at', { ascending: false })
        .limit(COMMENTS_PER_PAGE);
      olderItems = ((data || []) as CommentPreview[]).reverse();
    }

    if (olderItems.length > 0) {
      setComments((prev) => [...olderItems, ...prev]);
    }
    if (olderItems.length < COMMENTS_PER_PAGE) {
      setShowAll(true);
    }
    setLoadingMore(false);
  };

  const handleSubmit = async () => {
    if (!user || !body.trim()) return;
    setSubmitting(true);
    if (type === 'post') {
      const { data } = await supabase.from('comments')
        .insert({ post_id: parentId, author_id: user.id, body: body.trim() })
        .select('id, body, author_id, created_at').single();
      if (data) {
        setComments((prev) => [...prev, data as CommentPreview]);
        setTotalCount((c) => c + 1);
      }
    } else {
      const { data } = await supabase.from('notice_comments')
        .insert({ notice_id: parentId, author_id: user.id, body: body.trim() })
        .select('id, body, author_id, created_at').single();
      if (data) {
        setComments((prev) => [...prev, data as CommentPreview]);
        setTotalCount((c) => c + 1);
      }
    }
    setBody('');
    setSubmitting(false);
    onChanged?.();
  };

  const handleDelete = async (commentId: string) => {
    if (type === 'post') {
      await supabase.from('comments').delete().eq('id', commentId);
    } else {
      await supabase.from('notice_comments').delete().eq('id', commentId);
    }
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setTotalCount((prev) => prev - 1);
    onChanged?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hiddenCount = totalCount - comments.length;
  const canDelete = (c: CommentPreview) => user?.id === c.author_id || role === 'admin';

  const renderComment = (comment: CommentPreview) => {
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
      {hiddenCount > 0 && !showAll && (
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

      {comments.length > 0 && (
        <div className="space-y-2.5 mb-3">
          {comments.map(renderComment)}
        </div>
      )}

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
