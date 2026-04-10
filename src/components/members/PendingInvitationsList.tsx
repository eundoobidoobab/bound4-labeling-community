import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Mail, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDateTime } from '@/lib/formatDate';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { MemberInvitation } from '@/hooks/useMembersData';

interface PendingInvitationsListProps {
  invitations: MemberInvitation[];
  isAdmin: boolean;
  onCancelled: () => void;
}

export default function PendingInvitationsList({ invitations, isAdmin, onCancelled }: PendingInvitationsListProps) {
  const { toast } = useToast();
  const pending = invitations.filter(inv => inv.status === 'PENDING' && new Date(inv.expires_at) > new Date());

  if (pending.length === 0) return null;

  const handleCancel = async (id: string) => {
    const { error } = await supabase.from('project_invitations').update({ status: 'EXPIRED' }).eq('id', id);
    if (error) { toast({ title: '초대 취소 실패', description: error.message, variant: 'destructive' }); }
    else { toast({ title: '초대가 취소되었습니다' }); onCancelled(); }
  };

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
        <Mail className="h-4 w-4" /> 대기 중인 초대 ({pending.length})
      </h2>
      <div className="space-y-2">
        {pending.map((inv, i) => (
          <motion.div key={inv.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border bg-muted/20">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{inv.email}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(inv.created_at)} 초대 · {new Date(inv.expires_at).toLocaleDateString('ko-KR')} 만료
                </p>
              </div>
              <Badge variant="outline" className="text-xs text-muted-foreground">대기 중</Badge>
              {isAdmin && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="초대 취소" onClick={() => handleCancel(inv.id)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
