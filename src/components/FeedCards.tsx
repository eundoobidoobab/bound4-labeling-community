import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pin, MoreHorizontal, Trash2, Pencil, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDateTime } from '@/lib/formatDate';
import EditableContent from '@/components/EditableContent';
import FeedAttachments from '@/components/FeedAttachments';
import FeedComments from '@/components/FeedComments';
import type { Notice, Post, Attachment, Profile } from '@/types';

const TITLE_MAX = 80;
const BODY_MAX_LINES = 8;

function CollapsibleBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split('\n');
  const needsTruncate = lines.length > BODY_MAX_LINES || text.length > 500;

  if (!needsTruncate) {
    return <p className="text-sm text-foreground whitespace-pre-wrap break-words">{text}</p>;
  }

  const preview = expanded ? text : lines.slice(0, BODY_MAX_LINES).join('\n').slice(0, 500);

  return (
    <div>
      <p className="text-sm text-foreground whitespace-pre-wrap break-words">
        {preview}{!expanded && '...'}
      </p>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1 transition-colors"
      >
        {expanded ? <><ChevronUp className="h-3.5 w-3.5" /> 접기</> : <><ChevronDown className="h-3.5 w-3.5" /> 더보기</>}
      </button>
    </div>
  );
}

function TruncatedTitle({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (text.length <= TITLE_MAX) {
    return <CardTitle className="text-base mt-1 break-words">{text}</CardTitle>;
  }
  return (
    <CardTitle className="text-base mt-1 break-words cursor-pointer" onClick={() => setExpanded(!expanded)}>
      {expanded ? text : text.slice(0, TITLE_MAX) + '...'}
    </CardTitle>
  );
}

interface NoticeCardProps {
  notice: Notice;
  author: Profile | undefined;
  attachments: Attachment[];
  isAdmin: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (title: string, body: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onTogglePin: () => Promise<void>;
  onViewReads?: () => void;
}

export function NoticeCard({
  notice, author, attachments, isAdmin,
  isEditing, onEdit, onCancelEdit, onSave,
  onDelete, onTogglePin, onViewReads,
}: NoticeCardProps) {
  return (
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
                <span className="text-xs text-muted-foreground">{formatDateTime(notice.created_at)}</span>
                {notice.is_pinned && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                    <Pin className="h-3 w-3" /> 고정
                  </span>
                )}
              </div>
              <CardTitle className="text-base mt-1 break-words">{notice.title}</CardTitle>
            </div>
          </div>
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />수정
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onTogglePin}>
                  <Pin className="mr-2 h-4 w-4" />
                  {notice.is_pinned ? '고정 해제' : '고정'}
                </DropdownMenuItem>
                {onViewReads && (
                  <DropdownMenuItem onClick={onViewReads}>
                    <Eye className="mr-2 h-4 w-4" />확인율 보기
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="pl-16">
        {isEditing ? (
          <EditableContent
            title={notice.title}
            body={notice.body}
            onSave={onSave}
            onCancel={onCancelEdit}
          />
        ) : (
          <>
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">{notice.body}</p>
            <FeedAttachments attachments={attachments} />
            <FeedComments type="notice" parentId={notice.id} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface PostCardProps {
  post: Post;
  author: Profile | undefined;
  attachments: Attachment[];
  canManage: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (title: string, body: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function PostCard({
  post, author, attachments, canManage,
  isEditing, onEdit, onCancelEdit, onSave, onDelete,
}: PostCardProps) {
  return (
    <Card>
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
                <span className="text-xs text-muted-foreground">{formatDateTime(post.created_at)}</span>
              </div>
              <CardTitle className="text-base mt-1 break-words">{post.title}</CardTitle>
            </div>
          </div>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />수정
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="pl-16">
        {isEditing ? (
          <EditableContent
            title={post.title}
            body={post.body}
            onSave={onSave}
            onCancel={onCancelEdit}
          />
        ) : (
          <>
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">{post.body}</p>
            <FeedAttachments attachments={attachments} />
            <FeedComments type="post" parentId={post.id} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
