import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import {
  Loader2, Plus, Calendar, Clock, Users, CheckCircle2, XCircle,
  UserCheck, Send, ChevronRight, AlertTriangle, Package
} from 'lucide-react';
import { formatDateTime } from '@/lib/formatDate';
import { useToast } from '@/hooks/use-toast';

interface AllocationCall {
  id: string;
  board_id: string;
  title: string;
  description: string | null;
  work_date: string;
  apply_deadline: string;
  created_by: string;
  created_at: string;
}

interface Application {
  id: string;
  call_id: string;
  worker_id: string;
  status: 'APPLIED' | 'SELECTED' | 'REJECTED' | 'WITHDRAWN';
  created_at: string;
}

interface Assignment {
  id: string;
  call_id: string;
  worker_id: string;
  status: 'ASSIGNED' | 'DISTRIBUTED_DONE';
  data_ref: string | null;
  assigned_at: string;
  distributed_done_at: string | null;
}

interface Profile {
  id: string;
  display_name: string | null;
  email: string;
}

interface AllocationBoardProps {
  boardId: string;
  projectId: string;
}

export default function AllocationBoard({ boardId, projectId }: AllocationBoardProps) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === 'admin';

  const [calls, setCalls] = useState<AllocationCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  // Create call dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newWorkDate, setNewWorkDate] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Detail view
  const [selectedCall, setSelectedCall] = useState<AllocationCall | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Worker's own applications for quick status display
  const [myApplications, setMyApplications] = useState<Record<string, Application>>({});

  useEffect(() => {
    fetchCalls();
  }, [boardId]);

  const fetchCalls = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('allocation_calls')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: false });
    const items = (data || []) as AllocationCall[];
    setCalls(items);

    // Fetch profiles for creators
    const creatorIds = [...new Set(items.map(c => c.created_by))];
    if (creatorIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name, email').in('id', creatorIds);
      const map: Record<string, Profile> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);
    }

    // For workers: fetch their applications across all calls
    if (user && !isAdmin && items.length > 0) {
      const { data: apps } = await supabase
        .from('allocation_applications')
        .select('*')
        .eq('worker_id', user.id)
        .in('call_id', items.map(c => c.id));
      const appMap: Record<string, Application> = {};
      (apps || []).forEach((a: any) => { appMap[a.call_id] = a; });
      setMyApplications(appMap);
    }

    setLoading(false);
  };

  const fetchCallDetail = async (call: AllocationCall) => {
    setSelectedCall(call);
    setDetailLoading(true);

    const [appsRes, assignsRes] = await Promise.all([
      supabase.from('allocation_applications').select('*').eq('call_id', call.id).order('created_at', { ascending: true }),
      supabase.from('allocation_assignments').select('*').eq('call_id', call.id).order('assigned_at', { ascending: true }),
    ]);

    const apps = (appsRes.data || []) as Application[];
    const assigns = (assignsRes.data || []) as Assignment[];
    setApplications(apps);
    setAssignments(assigns);

    // Fetch worker profiles
    const workerIds = [...new Set([...apps.map(a => a.worker_id), ...assigns.map(a => a.worker_id)])];
    if (workerIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name, email').in('id', workerIds);
      if (profs) {
        setProfiles(prev => {
          const next = { ...prev };
          profs.forEach((p: any) => { next[p.id] = p; });
          return next;
        });
      }
    }

    setDetailLoading(false);
  };

  const handleCreateCall = async () => {
    if (!newTitle.trim() || !newWorkDate || !newDeadline || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('allocation_calls').insert({
        board_id: boardId,
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        work_date: newWorkDate,
        apply_deadline: new Date(newDeadline).toISOString(),
        created_by: user.id,
      });
      if (error) throw error;
      toast({ title: '배분 공고가 등록되었습니다' });
      setCreateOpen(false);
      setNewTitle(''); setNewDesc(''); setNewWorkDate(''); setNewDeadline('');
      fetchCalls();
    } catch (err: any) {
      toast({ title: '등록 실패', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApply = async (callId: string) => {
    if (!user) return;
    const { error } = await supabase.from('allocation_applications').insert({
      call_id: callId,
      worker_id: user.id,
    });
    if (error) {
      toast({ title: '신청 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '신청 완료' });
      fetchCalls();
      if (selectedCall?.id === callId) fetchCallDetail(selectedCall);
    }
  };

  const handleUpdateAppStatus = async (appId: string, status: 'SELECTED' | 'REJECTED') => {
    const { error } = await supabase.from('allocation_applications').update({ status }).eq('id', appId);
    if (error) {
      toast({ title: '상태 변경 실패', description: error.message, variant: 'destructive' });
    } else {
      if (selectedCall) fetchCallDetail(selectedCall);
    }
  };

  const handleAssignSelected = async () => {
    if (!selectedCall) return;
    const selectedWorkers = applications.filter(a => a.status === 'SELECTED');
    if (selectedWorkers.length === 0) {
      toast({ title: '선발된 작업자가 없습니다', variant: 'destructive' });
      return;
    }
    const existingWorkerIds = new Set(assignments.map(a => a.worker_id));
    const newAssigns = selectedWorkers
      .filter(a => !existingWorkerIds.has(a.worker_id))
      .map(a => ({
        call_id: selectedCall.id,
        worker_id: a.worker_id,
      }));
    if (newAssigns.length === 0) {
      toast({ title: '이미 모두 배정되었습니다' });
      return;
    }
    const { error } = await supabase.from('allocation_assignments').insert(newAssigns);
    if (error) {
      toast({ title: '배정 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${newAssigns.length}명이 배정되었습니다` });
      fetchCallDetail(selectedCall);
    }
  };

  const handleDistribute = async (assignmentId: string) => {
    const { error } = await supabase
      .from('allocation_assignments')
      .update({ status: 'DISTRIBUTED_DONE', distributed_done_at: new Date().toISOString() })
      .eq('id', assignmentId);
    if (error) {
      toast({ title: '배분 완료 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '배분 완료 처리되었습니다' });
      if (selectedCall) fetchCallDetail(selectedCall);
    }
  };

  const handleDistributeAll = async () => {
    if (!selectedCall) return;
    const pending = assignments.filter(a => a.status === 'ASSIGNED');
    if (pending.length === 0) return;
    const ids = pending.map(a => a.id);
    const { error } = await supabase
      .from('allocation_assignments')
      .update({ status: 'DISTRIBUTED_DONE', distributed_done_at: new Date().toISOString() })
      .in('id', ids);
    if (error) {
      toast({ title: '일괄 배분 완료 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${pending.length}명 배분 완료 처리` });
      fetchCallDetail(selectedCall);
    }
  };

  const getCallStatus = (call: AllocationCall) => {
    const now = new Date();
    const deadline = new Date(call.apply_deadline);
    if (now < deadline) return { label: '모집 중', variant: 'default' as const, icon: Users };
    return { label: '모집 마감', variant: 'secondary' as const, icon: Clock };
  };

  const getAppStatusBadge = (status: string) => {
    switch (status) {
      case 'APPLIED': return { label: '신청됨', variant: 'outline' as const };
      case 'SELECTED': return { label: '선발', variant: 'default' as const };
      case 'REJECTED': return { label: '미선발', variant: 'destructive' as const };
      case 'WITHDRAWN': return { label: '철회', variant: 'secondary' as const };
      default: return { label: status, variant: 'outline' as const };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Admin: Create new call */}
      {isAdmin && (
        <div className="mb-6">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> 새 배분 공고
          </Button>
        </div>
      )}

      {/* Calls list */}
      {calls.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">등록된 배분 공고가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call, i) => {
            const status = getCallStatus(call);
            const StatusIcon = status.icon;
            const creator = profiles[call.created_by];
            const myApp = myApplications[call.id];

            return (
              <motion.div key={call.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => fetchCallDetail(call)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={status.variant} className="gap-1 text-xs">
                            <StatusIcon className="h-3 w-3" /> {status.label}
                          </Badge>
                          {myApp && (
                            <Badge variant={getAppStatusBadge(myApp.status).variant} className="text-xs">
                              {getAppStatusBadge(myApp.status).label}
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-base">{call.title}</CardTitle>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        작업일: {call.work_date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        마감: {formatDateTime(call.apply_deadline)}
                      </span>
                    </div>
                    {call.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{call.description}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create call dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 배분 공고</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>공고 제목</Label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="예: 3월 15일 라벨링 작업자 모집" />
            </div>
            <div className="space-y-2">
              <Label>설명 (선택)</Label>
              <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="작업 내용, 요구사항 등을 설명하세요" rows={3} className="resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>작업일</Label>
                <Input type="date" value={newWorkDate} onChange={e => setNewWorkDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>신청 마감</Label>
                <Input type="datetime-local" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} />
              </div>
            </div>
            <Button className="w-full" onClick={handleCreateCall} disabled={submitting || !newTitle.trim() || !newWorkDate || !newDeadline}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 등록
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Call detail dialog */}
      <Dialog open={!!selectedCall} onOpenChange={v => !v && setSelectedCall(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          {selectedCall && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={getCallStatus(selectedCall).variant} className="gap-1 text-xs">
                    {getCallStatus(selectedCall).label}
                  </Badge>
                </div>
                <DialogTitle>{selectedCall.title}</DialogTitle>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                  <span>작업일: {selectedCall.work_date}</span>
                  <span>마감: {formatDateTime(selectedCall.apply_deadline)}</span>
                </div>
                {selectedCall.description && (
                  <p className="text-sm text-muted-foreground mt-2">{selectedCall.description}</p>
                )}
              </DialogHeader>

              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-6 mt-4">
                  {/* Worker: Apply button */}
                  {!isAdmin && (
                    <WorkerApplySection
                      call={selectedCall}
                      myApp={applications.find(a => a.worker_id === user?.id)}
                      myAssignment={assignments.find(a => a.worker_id === user?.id)}
                      onApply={() => handleApply(selectedCall.id)}
                    />
                  )}

                  {/* Admin: Applicants */}
                  {isAdmin && (
                    <>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <Users className="h-4 w-4" /> 신청자 ({applications.length}명)
                        </h3>
                        {applications.length === 0 ? (
                          <p className="text-sm text-muted-foreground">아직 신청자가 없습니다</p>
                        ) : (
                          <div className="space-y-2">
                            {applications.map(app => {
                              const worker = profiles[app.worker_id];
                              const badge = getAppStatusBadge(app.status);
                              return (
                                <div key={app.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                      {(worker?.display_name || worker?.email || '?').charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground">{worker?.display_name || worker?.email || '알 수 없음'}</p>
                                    <p className="text-xs text-muted-foreground">{formatDateTime(app.created_at)}</p>
                                  </div>
                                  <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
                                  {app.status === 'APPLIED' && (
                                    <div className="flex gap-1">
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:text-primary" onClick={() => handleUpdateAppStatus(app.id, 'SELECTED')}>
                                        <CheckCircle2 className="h-4 w-4" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleUpdateAppStatus(app.id, 'REJECTED')}>
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {applications.some(a => a.status === 'SELECTED') && (
                          <Button className="mt-3" size="sm" onClick={handleAssignSelected}>
                            <UserCheck className="mr-1 h-3.5 w-3.5" /> 선발자 배정
                          </Button>
                        )}
                      </div>

                      {/* Assignments */}
                      {assignments.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                            <Package className="h-4 w-4" /> 배정 현황 ({assignments.length}명)
                          </h3>
                          <div className="space-y-2">
                            {assignments.map(assign => {
                              const worker = profiles[assign.worker_id];
                              const isDone = assign.status === 'DISTRIBUTED_DONE';
                              return (
                                <div key={assign.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                      {(worker?.display_name || worker?.email || '?').charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground">{worker?.display_name || worker?.email || '알 수 없음'}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {isDone ? `배분 완료: ${formatDateTime(assign.distributed_done_at!)}` : `배정됨: ${formatDateTime(assign.assigned_at)}`}
                                    </p>
                                  </div>
                                  {isDone ? (
                                    <Badge variant="secondary" className="gap-1 text-primary text-xs">
                                      <CheckCircle2 className="h-3 w-3" /> 완료
                                    </Badge>
                                  ) : (
                                    <Button size="sm" variant="outline" onClick={() => handleDistribute(assign.id)}>
                                      <Send className="mr-1 h-3.5 w-3.5" /> 배분 완료
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {assignments.some(a => a.status === 'ASSIGNED') && (
                            <Button className="mt-3" size="sm" onClick={handleDistributeAll}>
                              <Send className="mr-1 h-3.5 w-3.5" /> 전체 배분 완료
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Worker's apply/status section
function WorkerApplySection({
  call,
  myApp,
  myAssignment,
  onApply,
}: {
  call: AllocationCall;
  myApp?: Application;
  myAssignment?: Assignment;
  onApply: () => void;
}) {
  const now = new Date();
  const deadline = new Date(call.apply_deadline);
  const isPastDeadline = now >= deadline;

  if (myAssignment) {
    const isDone = myAssignment.status === 'DISTRIBUTED_DONE';
    return (
      <Card className={isDone ? 'border-primary/30 bg-primary/5' : 'border-accent bg-accent/50'}>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            {isDone ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">배분 완료</p>
                  <p className="text-xs text-muted-foreground">
                    {myAssignment.distributed_done_at && formatDateTime(myAssignment.distributed_done_at)}
                  </p>
                </div>
              </>
            ) : (
              <>
                <Package className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-foreground">배정되었습니다</p>
                  <p className="text-xs text-muted-foreground">배분 완료를 기다리는 중입니다</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (myApp) {
    const badge = (() => {
      switch (myApp.status) {
        case 'APPLIED': return { label: '신청 완료 — 결과를 기다리는 중입니다', icon: Clock, color: 'text-primary' };
        case 'SELECTED': return { label: '선발되었습니다! 배정을 기다리는 중입니다', icon: CheckCircle2, color: 'text-primary' };
        case 'REJECTED': return { label: '이번 공고에서는 선발되지 않았습니다', icon: XCircle, color: 'text-destructive' };
        case 'WITHDRAWN': return { label: '신청이 철회되었습니다', icon: AlertTriangle, color: 'text-muted-foreground' };
        default: return { label: myApp.status, icon: Clock, color: 'text-muted-foreground' };
      }
    })();
    const Icon = badge.icon;
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Icon className={`h-5 w-5 ${badge.color}`} />
            <p className="text-sm text-foreground">{badge.label}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isPastDeadline) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">신청 마감이 지났습니다</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Button className="w-full" onClick={onApply}>
      <UserCheck className="mr-2 h-4 w-4" /> 작업 신청하기
    </Button>
  );
}
