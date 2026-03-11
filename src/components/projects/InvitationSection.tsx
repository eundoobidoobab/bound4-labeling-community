import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Mail } from 'lucide-react';
import type { Invitation } from '@/types';

interface InvitationSectionProps {
  invitations: Invitation[];
  acceptingId: string | null;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

export default function InvitationSection({ invitations, acceptingId, onAccept, onDecline }: InvitationSectionProps) {
  if (invitations.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="mb-6"
      >
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4" /> 받은 초대 ({invitations.length})
        </h3>
        <div className="space-y-3">
          {invitations.map((inv) => (
            <Card key={inv.id} className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    <span className="font-semibold">{inv.project_name}</span> 프로젝트에 초대되었습니다
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(inv.expires_at).toLocaleDateString('ko-KR')} 까지 유효
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => onDecline(inv.id)}>
                    거절
                  </Button>
                  <Button size="sm" onClick={() => onAccept(inv.id)} disabled={acceptingId === inv.id}>
                    {acceptingId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : '수락'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
