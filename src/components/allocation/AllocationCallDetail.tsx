import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, CheckCircle2, XCircle, Trash2, Pencil, MoreHorizontal, ChevronLeft, Ban } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2 } from 'lucide-react';
import { formatDateTime } from '@/lib/formatDate';
import type { AllocationCall, Application, Assignment, Profile } from './types';
import { getCallStatus } from './types';
import ApplicantTable from './ApplicantTable';
import WorkerDetailSection from './WorkerDetailSection';

interface CallDetailProps {
  call: AllocationCall;
  applications: Application[];
  assignments: Assignment[];
  profiles: Record<string, Profile>;
  isAdmin: boolean;
  userId?: string;
  detailLoading: boolean;
  checkedIds: Set<string>;
  quantityOverrides: Record<string, string>;
  submitting: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleClosed: () => void;
  onToggleCheck: (id: string) => void;
  onToggleAll: () => void;
  onQuantityOverride: (id: string, value: string) => void;
  onDistribute: () => void;
  onApplyClick: () => void;
  onCancelClick: () => void;
}

export default function AllocationCallDetail({
  call, applications, assignments, profiles, isAdmin, userId,
  detailLoading, checkedIds, quantityOverrides, submitting,
  onBack, onEdit, onDelete, onToggleClosed,
  onToggleCheck, onToggleAll, onQuantityOverride, onDistribute,
  onApplyClick, onCancelClick,
}: CallDetailProps) {
  const status = getCallStatus(call);
  const myApp = applications.find(a => a.worker_id === userId);
  const myAssignment = assignments.find(a => a.worker_id === userId);

  return (
    <div>
      <button
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        onClick={onBack}
      >
        <ChevronLeft className="h-4 w-4" />
        배분 게시판으로 돌아가기
      </button>

      <Card className="mb-6 relative">
        <CardContent className="py-6">
          {isAdmin && (
            <div className="absolute top-4 right-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="mr-2 h-4 w-4" />수정
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onToggleClosed}>
                    {call.is_closed ? (
                      <><CheckCircle2 className="mr-2 h-4 w-4" />마감 해제</>
                    ) : (
                      <><XCircle className="mr-2 h-4 w-4" />마감 처리</>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <div className="flex items-start gap-4 pr-10">
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Calendar className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-foreground">{call.title}</h2>
                <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
              </div>
              {call.description && (
                <p className="text-sm text-muted-foreground mb-3">{call.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {call.apply_deadline && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    신청 마감: {formatDateTime(call.apply_deadline)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {applications.length}명 신청
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {detailLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {!isAdmin && (
            <WorkerDetailSection
              call={call}
              myApp={myApp}
              myAssignment={myAssignment}
              onApplyClick={onApplyClick}
              onCancelClick={onCancelClick}
            />
          )}

          {isAdmin && (
            <ApplicantTable
              applications={applications}
              assignments={assignments}
              profiles={profiles}
              checkedIds={checkedIds}
              quantityOverrides={quantityOverrides}
              onToggleCheck={onToggleCheck}
              onToggleAll={onToggleAll}
              onQuantityOverride={onQuantityOverride}
              onDistribute={onDistribute}
              submitting={submitting}
            />
          )}
        </>
      )}
    </div>
  );
}
