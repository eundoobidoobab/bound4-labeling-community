import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, XCircle, AlertTriangle, Package, UserCheck, Ban } from 'lucide-react';
import { formatDateTime } from '@/lib/formatDate';
import type { AllocationCall, Application, Assignment } from './types';

interface WorkerDetailSectionProps {
  call: AllocationCall;
  myApp?: Application;
  myAssignment?: Assignment;
  onApplyClick: () => void;
  onCancelClick: () => void;
}

export default function WorkerDetailSection({ call, myApp, myAssignment, onApplyClick, onCancelClick }: WorkerDetailSectionProps) {
  const now = new Date();
  const isClosed = call.is_closed || (call.apply_deadline ? now >= new Date(call.apply_deadline) : false);

  if (myAssignment) {
    const isDone = myAssignment.status === 'DISTRIBUTED_DONE';
    return (
      <Card className={isDone ? 'border-primary/30 bg-primary/5' : ''}>
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            {isDone ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-base font-semibold text-foreground">배분 완료</p>
                  {myAssignment.assigned_quantity && (
                    <p className="text-sm text-muted-foreground">배분 수량: {myAssignment.assigned_quantity}</p>
                  )}
                  {myAssignment.distributed_done_at && (
                    <p className="text-xs text-muted-foreground">{formatDateTime(myAssignment.distributed_done_at)}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <Package className="h-6 w-6 text-muted-foreground" />
                <div>
                  <p className="text-base font-semibold text-foreground">배정되었습니다</p>
                  <p className="text-sm text-muted-foreground">배분 완료를 기다리는 중입니다</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (myApp) {
    const statusMap: Record<string, { label: string; icon: typeof Clock; color: string }> = {
      APPLIED: { label: '신청 완료 — 결과를 기다리는 중입니다', icon: Clock, color: 'text-primary' },
      SELECTED: { label: '선발되었습니다! 배정을 기다리는 중입니다', icon: CheckCircle2, color: 'text-primary' },
      REJECTED: { label: '이번 공고에서는 선발되지 않았습니다', icon: XCircle, color: 'text-destructive' },
      WITHDRAWN: { label: '신청이 철회되었습니다', icon: AlertTriangle, color: 'text-muted-foreground' },
    };
    const s = statusMap[myApp.status] || statusMap.APPLIED;
    const Icon = s.icon;

    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-sm text-foreground">{s.label}</p>
                {myApp.desired_quantity && (
                  <p className="text-xs text-muted-foreground mt-1">희망 수량: {myApp.desired_quantity}</p>
                )}
              </div>
            </div>
            {myApp.status === 'APPLIED' && (
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive shrink-0" onClick={onCancelClick}>
                신청 취소
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isClosed) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <Ban className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">이 공고는 마감되었습니다</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Button className="w-full" size="lg" onClick={onApplyClick}>
      <UserCheck className="mr-2 h-4 w-4" /> 작업 신청하기
    </Button>
  );
}
