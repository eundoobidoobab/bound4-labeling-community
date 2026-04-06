import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { motion } from 'framer-motion';
import {
  Loader2, Plus, Calendar, Clock, Users, CheckCircle2, XCircle,
  UserCheck, ChevronLeft, ChevronRight, AlertTriangle, Package, Send, MoreHorizontal, Pencil, Trash2
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  desired_quantity: number | null;
  worker_ref: string | null;
}

interface Assignment {
  id: string;
  call_id: string;
  worker_id: string;
  status: 'ASSIGNED' | 'DISTRIBUTED_DONE';
  data_ref: string | null;
  assigned_quantity: number | null;
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
  
  const [newDeadline, setNewDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Detail view (inline, not dialog)
  const [selectedCall, setSelectedCall] = useState<AllocationCall | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Admin: checked applicants for bulk distribute
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  // Admin: per-applicant assigned quantity overrides
  const [quantityOverrides, setQuantityOverrides] = useState<Record<string, string>>({});

  // Worker apply dialog
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyQuantity, setApplyQuantity] = useState('');
  const [applyWorkerRef, setApplyWorkerRef] = useState('');
  const [applyCallId, setApplyCallId] = useState<string | null>(null);

  // Worker's own applications
  const [myApplications, setMyApplications] = useState<Record<string, Application>>({});

  // Edit call dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editCall, setEditCall] = useState<AllocationCall | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  
  const [editDeadline, setEditDeadline] = useState('');

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

    const creatorIds = [...new Set(items.map(c => c.created_by))];
    if (creatorIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name, email').in('id', creatorIds);
      const map: Record<string, Profile> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);
    }

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
    setCheckedIds(new Set());
    setQuantityOverrides({});

    const [appsRes, assignsRes] = await Promise.all([
      supabase.from('allocation_applications').select('*').eq('call_id', call.id).order('created_at', { ascending: true }),
      supabase.from('allocation_assignments').select('*').eq('call_id', call.id).order('assigned_at', { ascending: true }),
    ]);

    const apps = (appsRes.data || []) as Application[];
    const assigns = (assignsRes.data || []) as Assignment[];
    setApplications(apps);
    setAssignments(assigns);

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
    if (!newTitle.trim() || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('allocation_calls').insert({
        board_id: boardId,
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        work_date: new Date().toISOString().slice(0, 10),
        apply_deadline: newDeadline ? new Date(newDeadline).toISOString() : null,
        created_by: user.id,
      } as any);
      if (error) throw error;
      toast({ title: '배분 공고가 등록되었습니다' });
      setCreateOpen(false);
      setNewTitle(''); setNewDesc(''); setNewDeadline('');
      fetchCalls();
    } catch (err: any) {
      toast({ title: '등록 실패', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditCall = async () => {
    if (!editCall || !editTitle.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('allocation_calls').update({
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        apply_deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
      } as any).eq('id', editCall.id);
      if (error) throw error;
      toast({ title: '공고가 수정되었습니다' });
      setEditOpen(false);
      setEditCall(null);
      fetchCalls();
      if (selectedCall?.id === editCall.id) {
        setSelectedCall({ ...selectedCall, title: editTitle.trim(), description: editDesc.trim() || null, apply_deadline: editDeadline ? new Date(editDeadline).toISOString() : null as any });
      }
    } catch (err: any) {
      toast({ title: '수정 실패', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCall = async (call: AllocationCall) => {
    if (!confirm(`"${call.title}" 공고를 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from('allocation_calls').delete().eq('id', call.id);
      if (error) throw error;
      toast({ title: '공고가 삭제되었습니다' });
      if (selectedCall?.id === call.id) setSelectedCall(null);
      fetchCalls();
    } catch (err: any) {
      toast({ title: '삭제 실패', description: err.message, variant: 'destructive' });
    }
  };

  const openEditDialog = (call: AllocationCall, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditCall(call);
    setEditTitle(call.title);
    setEditDesc(call.description || '');
    
    // Convert ISO deadline to datetime-local format
    const dl = new Date(call.apply_deadline);
    const local = dl.getFullYear() + '-' + String(dl.getMonth()+1).padStart(2,'0') + '-' + String(dl.getDate()).padStart(2,'0') + 'T' + String(dl.getHours()).padStart(2,'0') + ':' + String(dl.getMinutes()).padStart(2,'0');
    setEditDeadline(local);
    setEditOpen(true);
  };

  const handleApply = async () => {
    if (!user || !applyCallId) return;
    // Frontend deadline check
    const call = calls.find(c => c.id === applyCallId);
    if (call && new Date() > new Date(call.apply_deadline)) {
      toast({ title: '신청 마감', description: '신청 마감일이 지났습니다.', variant: 'destructive' });
      return;
    }
    const qty = applyQuantity.trim() ? parseInt(applyQuantity) : null;
    const { error } = await supabase.from('allocation_applications').upsert({
      call_id: applyCallId,
      worker_id: user.id,
      desired_quantity: qty,
      worker_ref: applyWorkerRef.trim() || null,
      status: 'APPLIED',
    } as any, { onConflict: 'call_id,worker_id' });
    if (error) {
      toast({ title: '신청 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '신청 완료' });
      setApplyOpen(false);
      setApplyQuantity('');
      setApplyWorkerRef('');
      setApplyCallId(null);
      fetchCalls();
      if (selectedCall?.id === applyCallId) fetchCallDetail(selectedCall);
    }
  };

  const handleUpdateAppStatus = async (appId: string, status: 'SELECTED' | 'REJECTED') => {
    const { error } = await supabase.from('allocation_applications').update({ status }).eq('id', appId);
    if (error) {
      toast({ title: '상태 변경 실패', description: error.message, variant: 'destructive' });
    } else if (selectedCall) {
      fetchCallDetail(selectedCall);
    }
  };

  const handleDistributeChecked = async () => {
    if (!selectedCall || checkedIds.size === 0) return;
    setSubmitting(true);

    try {
      // Get checked applications
      const checkedApps = applications.filter(a => checkedIds.has(a.id));

      // First, mark all checked as SELECTED if not already
      const toSelect = checkedApps.filter(a => a.status === 'APPLIED');
      for (const app of toSelect) {
        await supabase.from('allocation_applications').update({ status: 'SELECTED' }).eq('id', app.id);
      }

      // Create assignments for those who don't have one yet
      const existingWorkerIds = new Set(assignments.map(a => a.worker_id));
      const newAssigns = checkedApps
        .filter(a => !existingWorkerIds.has(a.worker_id))
        .map(a => {
          const overrideQty = quantityOverrides[a.id];
          const qty = overrideQty !== undefined && overrideQty !== ''
            ? parseInt(overrideQty)
            : a.desired_quantity;
          return {
            call_id: selectedCall.id,
            worker_id: a.worker_id,
            assigned_quantity: qty,
            status: 'DISTRIBUTED_DONE' as const,
            distributed_done_at: new Date().toISOString(),
          };
        });

      // Update existing assignments to DISTRIBUTED_DONE
      const existingToUpdate = checkedApps
        .filter(a => existingWorkerIds.has(a.worker_id))
        .map(a => {
          const assign = assignments.find(as => as.worker_id === a.worker_id);
          return assign;
        })
        .filter(Boolean) as Assignment[];

      for (const assign of existingToUpdate) {
        const app = checkedApps.find(a => a.worker_id === assign.worker_id);
        const overrideQty = app ? quantityOverrides[app.id] : undefined;
        const qty = overrideQty !== undefined && overrideQty !== ''
          ? parseInt(overrideQty)
          : app?.desired_quantity ?? assign.assigned_quantity;
        await supabase
          .from('allocation_assignments')
          .update({
            status: 'DISTRIBUTED_DONE',
            distributed_done_at: new Date().toISOString(),
            assigned_quantity: qty,
          } as any)
          .eq('id', assign.id);
      }

      if (newAssigns.length > 0) {
        const { error } = await supabase.from('allocation_assignments').insert(newAssigns as any);
        if (error) throw error;
      }

      // Send notifications via secure RPC
      const workerIds = checkedApps.map(a => a.worker_id);
      await supabase.rpc('send_project_notifications', {
        _user_ids: workerIds,
        _type: 'ALLOCATION_DISTRIBUTED',
        _title: '배분 할당 완료',
        _body: `"${selectedCall.title}" 작업이 배분되었습니다.`,
        _project_id: projectId,
        _deep_link: `/projects/${projectId}/boards/${boardId}`,
      });

      toast({ title: `${checkedIds.size}명에게 할당 완료` });
      fetchCallDetail(selectedCall);
    } catch (err: any) {
      toast({ title: '할당 실패', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCheck = (appId: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  };

  const toggleAll = () => {
    if (checkedIds.size === applications.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(applications.map(a => a.id)));
    }
  };

  const getCallStatus = (call: AllocationCall) => {
    if (!call.apply_deadline) return { label: '신청 중', variant: 'default' as const };
    const now = new Date();
    const deadline = new Date(call.apply_deadline);
    if (now < deadline) return { label: '신청 중', variant: 'default' as const };
    return { label: '마감', variant: 'secondary' as const };
  };

  const getAppStatusUI = (status: string) => {
    switch (status) {
      case 'APPLIED': return { label: '할당 전', color: 'text-muted-foreground', icon: Clock };
      case 'SELECTED': return { label: '할당 완료', color: 'text-primary', icon: CheckCircle2 };
      case 'REJECTED': return { label: '미선발', color: 'text-destructive', icon: XCircle };
      case 'WITHDRAWN': return { label: '철회', color: 'text-muted-foreground', icon: AlertTriangle };
      default: return { label: status, color: 'text-muted-foreground', icon: Clock };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Shared dialogs (rendered regardless of view)
  const applyDialog = (
    <Dialog open={applyOpen} onOpenChange={v => { if (!v) { setApplyOpen(false); setApplyQuantity(''); setApplyWorkerRef(''); setApplyCallId(null); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>작업 신청</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>작업자 ID</Label>
            <Input
              value={applyWorkerRef}
              onChange={e => setApplyWorkerRef(e.target.value)}
              placeholder="본인의 작업자 ID를 입력하세요"
            />
          </div>
          <div className="space-y-2">
            <Label>희망 수량 (선택)</Label>
            <Input
              type="number"
              min="1"
              value={applyQuantity}
              onChange={e => setApplyQuantity(e.target.value)}
              placeholder="배분 받고 싶은 수량을 입력하세요"
            />
            <p className="text-xs text-muted-foreground">입력하지 않으면 관리자가 수량을 결정합니다</p>
          </div>
          <Button className="w-full" onClick={handleApply}>
            <UserCheck className="mr-2 h-4 w-4" /> 신청하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Detail view (matches reference image)
  if (selectedCall) {
    const status = getCallStatus(selectedCall);
    const selectedCount = checkedIds.size;
    const isWorker = !isAdmin;
    const myApp = applications.find(a => a.worker_id === user?.id);
    const myAssignment = assignments.find(a => a.worker_id === user?.id);

    return (
      <div>
        {/* Back button */}
        <button
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          onClick={() => setSelectedCall(null)}
        >
          <ChevronLeft className="h-4 w-4" />
          할당 게시판으로 돌아가기
        </button>

        {/* Call info card */}
        <Card className="mb-6">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-foreground">{selectedCall.title}</h2>
                  <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 ml-1">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(selectedCall)}>
                          <Pencil className="mr-2 h-4 w-4" />수정
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteCall(selectedCall)}>
                          <Trash2 className="mr-2 h-4 w-4" />삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {selectedCall.description && (
                  <p className="text-sm text-muted-foreground mb-3">{selectedCall.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {selectedCall.apply_deadline && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      신청 마감: {formatDateTime(selectedCall.apply_deadline)}
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
            {/* Worker view */}
            {isWorker && (
              <WorkerDetailSection
                call={selectedCall}
                myApp={myApp}
                myAssignment={myAssignment}
                onApplyClick={() => {
                  setApplyCallId(selectedCall.id);
                  setApplyOpen(true);
                }}
              />
            )}

            {/* Admin: Applicant list */}
            {isAdmin && (
              <Card>
                <CardContent className="py-6">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-foreground">
                      신청자 목록 ({applications.length}명)
                    </h3>
                    <div className="flex items-center gap-3">
                      {selectedCount > 0 && (
                        <span className="text-sm text-muted-foreground">{selectedCount}명 선택됨</span>
                      )}
                      <Button
                        onClick={handleDistributeChecked}
                        disabled={selectedCount === 0 || submitting}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5"
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
                      {/* Table header */}
                      <div className="grid grid-cols-[40px_1fr_100px_120px_100px_120px] items-center px-4 py-3 bg-muted/50 text-xs text-muted-foreground font-medium border-b border-border">
                        <div>
                          <Checkbox
                            checked={checkedIds.size === applications.length && applications.length > 0}
                            onCheckedChange={toggleAll}
                          />
                        </div>
                        <div>작업자</div>
                        <div>작업자 ID</div>
                        <div>희망 수량</div>
                        <div>신청 시각</div>
                        <div className="text-right">상태</div>
                      </div>

                      {/* Rows */}
                      {applications.map((app) => {
                        const worker = profiles[app.worker_id];
                        const statusUI = getAppStatusUI(app.status);
                        const StatusIcon = statusUI.icon;
                        const isChecked = checkedIds.has(app.id);
                        const existingAssignment = assignments.find(a => a.worker_id === app.worker_id);
                        const isDone = existingAssignment?.status === 'DISTRIBUTED_DONE';
                        const initial = (worker?.display_name || worker?.email || '?').charAt(0).toUpperCase();

                        // Color for avatar
                        const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
                        const colorIdx = initial.charCodeAt(0) % colors.length;

                        return (
                          <div
                            key={app.id}
                            className={`grid grid-cols-[40px_1fr_100px_120px_100px_120px] items-center px-4 py-3 border-b border-border last:border-b-0 transition-colors ${
                              isChecked ? 'bg-primary/5' : 'hover:bg-muted/30'
                            } ${isDone ? 'opacity-60' : ''}`}
                          >
                            <div>
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => toggleCheck(app.id)}
                                disabled={isDone}
                              />
                            </div>
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="h-9 w-9 shrink-0">
                                <AvatarFallback className={`text-xs text-white ${colors[colorIdx]}`}>
                                  {initial}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {worker?.display_name || worker?.email || '알 수 없음'}
                                </p>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {app.worker_ref || '-'}
                            </div>
                            <div>
                              {isDone ? (
                                <span className="text-sm text-foreground">
                                  {existingAssignment?.assigned_quantity ?? app.desired_quantity ?? '-'}
                                </span>
                              ) : isChecked ? (
                                <Input
                                  type="number"
                                  className="h-8 w-20 text-sm"
                                  placeholder={app.desired_quantity?.toString() || '-'}
                                  value={quantityOverrides[app.id] ?? app.desired_quantity?.toString() ?? ''}
                                  onChange={e => setQuantityOverrides(prev => ({ ...prev, [app.id]: e.target.value }))}
                                />
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {app.desired_quantity ?? '-'}
                                </span>
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
                                  <StatusIcon className={`h-3.5 w-3.5 ${statusUI.color}`} />
                                  <span className={`text-xs ${statusUI.color}`}>{statusUI.label}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
        {/* Edit call dialog (detail view) */}
        <Dialog open={editOpen} onOpenChange={(v) => { if (!v) { setEditOpen(false); setEditCall(null); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>공고 수정</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>공고 제목</Label>
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>설명 (선택)</Label>
                <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} className="resize-none" />
              </div>
              <div className="space-y-2">
                <Label>신청 마감</Label>
                <Input type="datetime-local" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleEditCall} disabled={submitting || !editTitle.trim() || !editDeadline}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 저장
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {applyDialog}
      </div>
    );
  }

  // Calls list view
  return (
    <div>
      {isAdmin && (
        <div className="mb-6">
          <Button onClick={() => setCreateOpen(true)}>
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
                <Card
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => fetchCallDetail(call)}
                >
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
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(call); }}>
                                <Pencil className="mr-2 h-4 w-4" />수정
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteCall(call); }}>
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
            <div className="space-y-2">
              <Label>신청 마감</Label>
              <Input type="datetime-local" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleCreateCall} disabled={submitting || !newTitle.trim() || !newDeadline}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 등록
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit call dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { if (!v) { setEditOpen(false); setEditCall(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>공고 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>공고 제목</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>설명 (선택)</Label>
              <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} className="resize-none" />
            </div>
            <div className="space-y-2">
              <Label>신청 마감</Label>
              <Input type="datetime-local" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleEditCall} disabled={submitting || !editTitle.trim() || !editDeadline}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {applyDialog}
    </div>
  );
}

// Worker detail section
function WorkerDetailSection({
  call,
  myApp,
  myAssignment,
  onApplyClick,
}: {
  call: AllocationCall;
  myApp?: Application;
  myAssignment?: Assignment;
  onApplyClick: () => void;
}) {
  const now = new Date();
  const deadline = new Date(call.apply_deadline);
  const isPastDeadline = now >= deadline;

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
    const statusMap: Record<string, { label: string; icon: any; color: string }> = {
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
          <div className="flex items-center gap-3">
            <Icon className={`h-5 w-5 ${s.color}`} />
            <div>
              <p className="text-sm text-foreground">{s.label}</p>
              {myApp.desired_quantity && (
                <p className="text-xs text-muted-foreground mt-1">희망 수량: {myApp.desired_quantity}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isPastDeadline) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <Clock className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">신청 마감이 지났습니다</p>
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
