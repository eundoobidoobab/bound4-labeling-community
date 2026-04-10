import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pencil, Check, X, MessageSquare, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDateTime } from '@/lib/formatDate';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UnifiedMember {
  key: string;
  userId: string;
  display_name: string | null;
  email: string;
  roleLabel: string;
  isAdmin: boolean;
  adminRowId?: string;
  customRole: string | null;
  membershipId?: string;
  joinedAt: string | null;
}

interface MemberRowProps {
  member: UnifiedMember;
  index: number;
  currentUserId: string | undefined;
  isCurrentUserAdmin: boolean;
  globalRole: string | null;
  onRemove: (membershipId: string) => void;
  onStartDm: (targetUserId: string, targetIsAdmin: boolean) => void;
  onRoleChange: (userId: string, name: string, toRole: 'admin' | 'worker') => void;
  onRoleSaved: () => void;
}

export function MemberDesktopRow({ member: m, index: i, currentUserId, isCurrentUserAdmin, globalRole, onRemove, onStartDm, onRoleChange, onRoleSaved }: MemberRowProps) {
  const { toast } = useToast();
  const [editingRole, setEditingRole] = useState(false);
  const [editRoleValue, setEditRoleValue] = useState(m.customRole || '');

  const saveCustomRole = async () => {
    const { error } = await supabase.from('project_admins').update({ custom_role: editRoleValue.trim() || null } as any).eq('id', m.adminRowId!);
    if (error) { toast({ title: '역할 수정 실패', description: error.message, variant: 'destructive' }); }
    else { toast({ title: '역할이 수정되었습니다' }); onRoleSaved(); }
    setEditingRole(false);
  };

  return (
    <motion.div key={m.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
      className="grid grid-cols-[1fr_120px_100px_160px_100px] items-center gap-2 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors group">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className={`text-xs ${m.isAdmin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
            {(m.display_name || m.email).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{m.display_name || m.email}</p>
          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {m.isAdmin && editingRole ? (
          <div className="flex items-center gap-1">
            <Input value={editRoleValue} onChange={(e) => setEditRoleValue(e.target.value)} placeholder="예: PM" className="h-7 text-xs w-20"
              onKeyDown={(e) => { if (e.key === 'Enter') saveCustomRole(); if (e.key === 'Escape') setEditingRole(false); }} autoFocus />
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveCustomRole}><Check className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingRole(false)}><X className="h-3 w-3" /></Button>
          </div>
        ) : (
          <>
            <Badge variant={m.isAdmin ? 'default' : 'secondary'}
              className={`text-xs ${m.isAdmin ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-primary/10 text-primary hover:bg-primary/10'}`}>
              {m.roleLabel}
            </Badge>
            {m.isAdmin && isCurrentUserAdmin && (
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => { setEditRoleValue(m.customRole || ''); setEditingRole(true); }}>
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </Button>
            )}
          </>
        )}
      </div>
      <div><Badge variant="outline" className="text-xs text-muted-foreground">{m.isAdmin ? '관리자' : '참여자'}</Badge></div>
      <div className="text-xs text-muted-foreground">{m.joinedAt ? formatDateTime(m.joinedAt) : '-'}</div>
      <div className="flex justify-end gap-2">
        {!isCurrentUserAdmin && m.isAdmin && m.userId !== currentUserId && (
          <Button variant="ghost" size="icon" className="h-7 w-7" title="메시지 보내기" onClick={() => onStartDm(m.userId, true)}><MessageSquare className="h-4 w-4 text-muted-foreground" /></Button>
        )}
        {isCurrentUserAdmin && !m.isAdmin && m.userId !== currentUserId && (
          <Button variant="ghost" size="icon" className="h-7 w-7" title="메시지 보내기" onClick={() => onStartDm(m.userId, false)}><MessageSquare className="h-4 w-4 text-muted-foreground" /></Button>
        )}
        {globalRole === 'admin' && m.userId !== currentUserId && (
          m.isAdmin ? (
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" title="작업자로 변경"
              onClick={() => onRoleChange(m.userId, m.display_name || m.email, 'worker')}>
              <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" title="관리자로 승격"
              onClick={() => onRoleChange(m.userId, m.display_name || m.email, 'admin')}>
              <ArrowUpCircle className="h-4 w-4 text-primary" />
            </Button>
          )
        )}
        {!m.isAdmin && isCurrentUserAdmin && (
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={() => onRemove(m.membershipId!)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export function MemberMobileCard({ member: m, index: i, currentUserId, isCurrentUserAdmin, globalRole, onRemove, onStartDm, onRoleChange }: Omit<MemberRowProps, 'onRoleSaved'>) {
  return (
    <motion.div key={m.key} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="rounded-lg border border-border p-4 bg-card">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className={`text-xs ${m.isAdmin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
            {(m.display_name || m.email).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{m.display_name || m.email}</p>
          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant={m.isAdmin ? 'default' : 'secondary'}
              className={`text-xs ${m.isAdmin ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-primary/10 text-primary hover:bg-primary/10'}`}>
              {m.roleLabel}
            </Badge>
            <Badge variant="outline" className="text-xs text-muted-foreground">{m.isAdmin ? '관리자' : '참여자'}</Badge>
            {m.joinedAt && <span className="text-[10px] text-muted-foreground">{formatDateTime(m.joinedAt)}</span>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {!isCurrentUserAdmin && m.isAdmin && m.userId !== currentUserId && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onStartDm(m.userId, true)}><MessageSquare className="h-4 w-4 text-muted-foreground" /></Button>
          )}
          {isCurrentUserAdmin && !m.isAdmin && m.userId !== currentUserId && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onStartDm(m.userId, false)}><MessageSquare className="h-4 w-4 text-muted-foreground" /></Button>
          )}
          {globalRole === 'admin' && m.userId !== currentUserId && (
            m.isAdmin ? (
              <Button variant="ghost" size="icon" className="h-8 w-8" title="작업자로 변경" onClick={() => onRoleChange(m.userId, m.display_name || m.email, 'worker')}>
                <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8" title="관리자로 승격" onClick={() => onRoleChange(m.userId, m.display_name || m.email, 'admin')}>
                <ArrowUpCircle className="h-4 w-4 text-primary" />
              </Button>
            )
          )}
          {!m.isAdmin && isCurrentUserAdmin && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onRemove(m.membershipId!)}><X className="h-4 w-4" /></Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
