import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Plus, Clock, Users, ChevronRight, MoreHorizontal, Pencil, Trash2, Package } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDateTime } from '@/lib/formatDate';
import type { AllocationCall, Application } from './types';
import { getCallStatus, getAppStatusUI } from './types';

interface CallListProps {
  calls: AllocationCall[];
  isAdmin: boolean;
  myApplications: Record<string, Application>;
  applicationCounts: Record<string, number>;
  onSelectCall: (call: AllocationCall) => void;
  onCreateClick: () => void;
  onEditClick: (call: AllocationCall, e?: React.MouseEvent) => void;
  onDeleteClick: (call: AllocationCall) => void;
}

export default function AllocationCallList({
  calls, isAdmin, myApplications, applicationCounts,
  onSelectCall, onCreateClick, onEditClick, onDeleteClick,
}: CallListProps) {
  return (
    <div>
      {isAdmin && (
        <div className="mb-6">
          <Button onClick={onCreateClick}>
            <Plus className="mr-2 h-4 w-4" /> 새 배분 공고
          </Button>
        </div>
      )}

      {calls.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">등록된 배분 공고가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call, i) => {
            const status = getCallStatus(call);
            const myApp = myApplications[call.id];
            return (
              <motion.div key={call.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => onSelectCall(call)}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-semibold text-foreground">{call.title}</span>
                          <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                          {myApp && (
                            <Badge variant={myApp.status === 'SELECTED' ? 'default' : 'outline'} className="text-xs">
                              {getAppStatusUI(myApp.status).label}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {call.apply_deadline && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              마감: {formatDateTime(call.apply_deadline)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {applicationCounts[call.id] || 0}명 신청
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditClick(call); }}>
                                <Pencil className="mr-2 h-4 w-4" />수정
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteClick(call); }}>
                                <Trash2 className="mr-2 h-4 w-4" />삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
