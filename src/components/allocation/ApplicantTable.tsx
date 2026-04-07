import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Loader2, CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';
import type { Application, Assignment, Profile } from './types';
import { getAppStatusUI } from './types';

interface ApplicantTableProps {
  applications: Application[];
  assignments: Assignment[];
  profiles: Record<string, Profile>;
  checkedIds: Set<string>;
  quantityOverrides: Record<string, string>;
  onToggleCheck: (id: string) => void;
  onToggleAll: () => void;
  onQuantityOverride: (id: string, value: string) => void;
  onDistribute: () => void;
  submitting: boolean;
}

const AVATAR_COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];

export default function ApplicantTable({
  applications, assignments, profiles, checkedIds, quantityOverrides,
  onToggleCheck, onToggleAll, onQuantityOverride, onDistribute, submitting,
}: ApplicantTableProps) {
  // Only selectable (non-done) applications for toggle all
  const selectableApps = applications.filter(a => {
    const existing = assignments.find(as => as.worker_id === a.worker_id);
    return !(existing?.status === 'DISTRIBUTED_DONE');
  });

  const selectedCount = checkedIds.size;

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'APPLIED': return <Clock className="h-3.5 w-3.5" />;
      case 'SELECTED': return <CheckCircle2 className="h-3.5 w-3.5" />;
      case 'REJECTED': return <XCircle className="h-3.5 w-3.5" />;
      case 'WITHDRAWN': return <AlertTriangle className="h-3.5 w-3.5" />;
      default: return <Clock className="h-3.5 w-3.5" />;
    }
  };

  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">
            신청자 목록 ({applications.length}명)
          </h3>
          <div className="flex items-center gap-3">
            {selectedCount > 0 && (
              <span className="text-sm text-muted-foreground">{selectedCount}명 선택됨</span>
            )}
            <Button
              onClick={onDistribute}
              disabled={selectedCount === 0 || submitting}
              className="gap-1.5"
              variant="default"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              할당 완료
            </Button>
          </div>
        </div>

        {applications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">아직 신청자가 없습니다</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Desktop header */}
            <div className="hidden md:grid grid-cols-[40px_1fr_minmax(120px,auto)_120px_100px_120px] items-center px-4 py-3 bg-muted/50 text-xs text-muted-foreground font-medium border-b border-border">
              <div>
                <Checkbox
                  checked={selectableApps.length > 0 && selectableApps.every(a => checkedIds.has(a.id))}
                  onCheckedChange={onToggleAll}
                />
              </div>
              <div>작업자</div>
              <div>작업자 ID</div>
              <div>희망 수량</div>
              <div>신청 시각</div>
              <div className="text-right">상태</div>
            </div>

            {/* Mobile select-all */}
            <div className="md:hidden flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
              <Checkbox
                checked={selectableApps.length > 0 && selectableApps.every(a => checkedIds.has(a.id))}
                onCheckedChange={onToggleAll}
              />
              <span className="text-xs text-muted-foreground">전체 선택</span>
            </div>

            {applications.map((app) => {
              const worker = profiles[app.worker_id];
              const statusUI = getAppStatusUI(app.status);
              const isChecked = checkedIds.has(app.id);
              const existingAssignment = assignments.find(a => a.worker_id === app.worker_id);
              const isDone = existingAssignment?.status === 'DISTRIBUTED_DONE';
              const initial = (worker?.display_name || worker?.email || '?').charAt(0).toUpperCase();
              const colorIdx = initial.charCodeAt(0) % AVATAR_COLORS.length;

              return (
                <div key={app.id}>
                  {/* Desktop row */}
                  <div className={`hidden md:grid grid-cols-[40px_1fr_100px_120px_100px_120px] items-center px-4 py-3 border-b border-border last:border-b-0 transition-colors ${isChecked ? 'bg-primary/5' : 'hover:bg-muted/30'} ${isDone ? 'opacity-60' : ''}`}>
                    <div>
                      <Checkbox checked={isChecked} onCheckedChange={() => onToggleCheck(app.id)} disabled={isDone} />
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className={`text-xs text-white ${AVATAR_COLORS[colorIdx]}`}>{initial}</AvatarFallback>
                      </Avatar>
                      <p className="text-sm font-medium text-foreground truncate">{worker?.display_name || worker?.email || '알 수 없음'}</p>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{app.worker_ref || '-'}</div>
                    <div>
                      {isDone ? (
                        <span className="text-sm text-foreground">{existingAssignment?.assigned_quantity ?? app.desired_quantity ?? '-'}</span>
                      ) : isChecked ? (
                        <Input
                          type="number"
                          className="h-8 w-20 text-sm"
                          placeholder={app.desired_quantity?.toString() || '-'}
                          value={quantityOverrides[app.id] ?? app.desired_quantity?.toString() ?? ''}
                          onChange={e => onQuantityOverride(app.id, e.target.value)}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">{app.desired_quantity ?? '-'}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(app.created_at).toLocaleDateString('ko-KR')} {new Date(app.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-right">
                      {isDone ? (
                        <Badge variant="secondary" className="gap-1 text-xs text-primary">
                          <CheckCircle2 className="h-3 w-3" /> 배분완료
                        </Badge>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <StatusIcon status={app.status} />
                          <span className={`text-xs ${statusUI.color}`}>{statusUI.label}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile card */}
                  <div className={`md:hidden flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 transition-colors ${isChecked ? 'bg-primary/5' : ''} ${isDone ? 'opacity-60' : ''}`}>
                    <Checkbox checked={isChecked} onCheckedChange={() => onToggleCheck(app.id)} disabled={isDone} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className={`text-xs text-white ${AVATAR_COLORS[colorIdx]}`}>{initial}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-foreground truncate">{worker?.display_name || worker?.email || '알 수 없음'}</span>
                        {isDone ? (
                          <Badge variant="secondary" className="gap-1 text-xs text-primary ml-auto shrink-0">
                            <CheckCircle2 className="h-3 w-3" /> 배분완료
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-1 ml-auto shrink-0">
                            <StatusIcon status={app.status} />
                            <span className={`text-xs ${statusUI.color}`}>{statusUI.label}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {app.worker_ref && <span>ID: {app.worker_ref}</span>}
                        <span>수량: {isDone ? (existingAssignment?.assigned_quantity ?? app.desired_quantity ?? '-') : (app.desired_quantity ?? '-')}</span>
                        <span>{new Date(app.created_at).toLocaleDateString('ko-KR')}</span>
                      </div>
                      {isChecked && !isDone && (
                        <div className="mt-2">
                          <Input
                            type="number"
                            className="h-8 w-full text-sm"
                            placeholder={`할당 수량 (희망: ${app.desired_quantity ?? '-'})`}
                            value={quantityOverrides[app.id] ?? app.desired_quantity?.toString() ?? ''}
                            onChange={e => onQuantityOverride(app.id, e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
