import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import type { AllocationCall, Application, Assignment, Profile, AllocationBoardProps } from './allocation/types';
import AllocationCallList from './allocation/AllocationCallList';
import AllocationCallDetail from './allocation/AllocationCallDetail';
import { ApplyDialog, CallFormDialog } from './allocation/AllocationDialogs';

export default function AllocationBoard({ boardId, projectId }: AllocationBoardProps) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === 'admin';

  const [calls, setCalls] = useState<AllocationCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  // Create call
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Detail view
  const [selectedCall, setSelectedCall] = useState<AllocationCall | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Admin bulk
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [quantityOverrides, setQuantityOverrides] = useState<Record<string, string>>({});

  // Worker apply
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyQuantity, setApplyQuantity] = useState('');
  const [applyWorkerRef, setApplyWorkerRef] = useState('');
  const [applyCallId, setApplyCallId] = useState<string | null>(null);

  // Worker's own applications & counts
  const [myApplications, setMyApplications] = useState<Record<string, Application>>({});
  const [applicationCounts, setApplicationCounts] = useState<Record<string, number>>({});

  // Edit call
  const [editOpen, setEditOpen] = useState(false);
  const [editCall, setEditCall] = useState<AllocationCall | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDeadline, setEditDeadline] = useState('');

  useEffect(() => { fetchCalls(); }, [boardId]);

  const fetchCalls = async () => {
    setLoading(true);
    const { data } = await supabase.from('allocation_calls').select('*').eq('board_id', boardId).order('created_at', { ascending: false });
    const items = (data || []) as AllocationCall[];
    setCalls(items);

    const creatorIds = [...new Set(items.map(c => c.created_by))];
    if (creatorIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name, email').in('id', creatorIds);
      const map: Record<string, Profile> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);
    }

    if (items.length > 0) {
      const { data: countData } = await supabase.from('allocation_applications').select('call_id').in('call_id', items.map(c => c.id));
      const counts: Record<string, number> = {};
      (countData || []).forEach((a: any) => { counts[a.call_id] = (counts[a.call_id] || 0) + 1; });
      setApplicationCounts(counts);
    }

    if (user && !isAdmin && items.length > 0) {
      const { data: apps } = await supabase.from('allocation_applications').select('*').eq('worker_id', user.id).in('call_id', items.map(c => c.id));
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
        board_id: boardId, title: newTitle.trim(), description: newDesc.trim() || null,
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
    } finally { setSubmitting(false); }
  };

  const handleEditCall = async () => {
    if (!editCall || !editTitle.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('allocation_calls').update({
        title: editTitle.trim(), description: editDesc.trim() || null,
        apply_deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
      } as any).eq('id', editCall.id);
      if (error) throw error;
      toast({ title: '공고가 수정되었습니다' });
      setEditOpen(false); setEditCall(null);
      fetchCalls();
      if (selectedCall?.id === editCall.id) {
        setSelectedCall({ ...selectedCall, title: editTitle.trim(), description: editDesc.trim() || null, apply_deadline: editDeadline ? new Date(editDeadline).toISOString() : null } as AllocationCall);
      }
    } catch (err: any) {
      toast({ title: '수정 실패', description: err.message, variant: 'destructive' });
    } finally { setSubmitting(false); }
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

  const openEditDialog = (call: AllocationCall) => {
    setEditCall(call);
    setEditTitle(call.title);
    setEditDesc(call.description || '');
    if (call.apply_deadline) {
      const dl = new Date(call.apply_deadline);
      const local = dl.getFullYear() + '-' + String(dl.getMonth() + 1).padStart(2, '0') + '-' + String(dl.getDate()).padStart(2, '0') + 'T' + String(dl.getHours()).padStart(2, '0') + ':' + String(dl.getMinutes()).padStart(2, '0');
      setEditDeadline(local);
    } else {
      setEditDeadline('');
    }
    setEditOpen(true);
  };

  const handleApply = async () => {
    if (!user || !applyCallId) return;
    const call = calls.find(c => c.id === applyCallId);
    if (call?.is_closed || (call?.apply_deadline && new Date() > new Date(call.apply_deadline))) {
      toast({ title: '신청 마감', description: '이 공고는 마감되었습니다.', variant: 'destructive' });
      return;
    }
    const qty = applyQuantity.trim() ? parseInt(applyQuantity) : null;
    const { error } = await supabase.from('allocation_applications').upsert({
      call_id: applyCallId, worker_id: user.id, desired_quantity: qty,
      worker_ref: applyWorkerRef.trim() || null, status: 'APPLIED',
    } as any, { onConflict: 'call_id,worker_id' });
    if (error) {
      toast({ title: '신청 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '신청 완료' });
      setApplyOpen(false); setApplyQuantity(''); setApplyWorkerRef(''); setApplyCallId(null);
      fetchCalls();
      if (selectedCall?.id === applyCallId) fetchCallDetail(selectedCall);
    }
  };

  const handleDistributeChecked = async () => {
    if (!selectedCall || checkedIds.size === 0) return;
    setSubmitting(true);
    try {
      const checkedApps = applications.filter(a => checkedIds.has(a.id));
      const toSelect = checkedApps.filter(a => a.status === 'APPLIED');
      for (const app of toSelect) {
        await supabase.from('allocation_applications').update({ status: 'SELECTED' }).eq('id', app.id);
      }

      const existingWorkerIds = new Set(assignments.map(a => a.worker_id));
      const newAssigns = checkedApps
        .filter(a => !existingWorkerIds.has(a.worker_id))
        .map(a => {
          const overrideQty = quantityOverrides[a.id];
          const qty = overrideQty !== undefined && overrideQty !== '' ? parseInt(overrideQty) : a.desired_quantity;
          return { call_id: selectedCall.id, worker_id: a.worker_id, assigned_quantity: qty, status: 'DISTRIBUTED_DONE' as const, distributed_done_at: new Date().toISOString() };
        });

      const existingToUpdate = checkedApps
        .filter(a => existingWorkerIds.has(a.worker_id))
        .map(a => assignments.find(as => as.worker_id === a.worker_id))
        .filter(Boolean) as Assignment[];

      for (const assign of existingToUpdate) {
        const app = checkedApps.find(a => a.worker_id === assign.worker_id);
        const overrideQty = app ? quantityOverrides[app.id] : undefined;
        const qty = overrideQty !== undefined && overrideQty !== '' ? parseInt(overrideQty) : app?.desired_quantity ?? assign.assigned_quantity;
        await supabase.from('allocation_assignments').update({ status: 'DISTRIBUTED_DONE', distributed_done_at: new Date().toISOString(), assigned_quantity: qty } as any).eq('id', assign.id);
      }

      if (newAssigns.length > 0) {
        const { error } = await supabase.from('allocation_assignments').insert(newAssigns as any);
        if (error) throw error;
      }

      await supabase.rpc('send_project_notifications', {
        _user_ids: checkedApps.map(a => a.worker_id),
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
    } finally { setSubmitting(false); }
  };

  const toggleCheck = (appId: string) => {
    // Prevent checking already distributed items
    const app = applications.find(a => a.id === appId);
    if (app) {
      const existing = assignments.find(a => a.worker_id === app.worker_id);
      if (existing?.status === 'DISTRIBUTED_DONE') return;
    }
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId); else next.add(appId);
      return next;
    });
  };

  const toggleAll = () => {
    const selectableApps = applications.filter(a => {
      const existing = assignments.find(as => as.worker_id === a.worker_id);
      return !(existing?.status === 'DISTRIBUTED_DONE');
    });
    const allChecked = selectableApps.length > 0 && selectableApps.every(a => checkedIds.has(a.id));
    if (allChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(selectableApps.map(a => a.id)));
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
      {selectedCall ? (
        <AllocationCallDetail
          call={selectedCall}
          applications={applications}
          assignments={assignments}
          profiles={profiles}
          isAdmin={isAdmin}
          userId={user?.id}
          detailLoading={detailLoading}
          checkedIds={checkedIds}
          quantityOverrides={quantityOverrides}
          submitting={submitting}
          onBack={() => setSelectedCall(null)}
          onEdit={() => openEditDialog(selectedCall)}
          onDelete={() => handleDeleteCall(selectedCall)}
          onToggleClosed={async () => {
            const newClosed = !selectedCall.is_closed;
            await supabase.from('allocation_calls').update({ is_closed: newClosed } as any).eq('id', selectedCall.id);
            toast({ title: newClosed ? '마감 처리되었습니다' : '마감이 해제되었습니다' });
            fetchCalls();
            fetchCallDetail({ ...selectedCall, is_closed: newClosed });
          }}
          onToggleCheck={toggleCheck}
          onToggleAll={toggleAll}
          onQuantityOverride={(id, value) => setQuantityOverrides(prev => ({ ...prev, [id]: value }))}
          onDistribute={handleDistributeChecked}
          onApplyClick={() => { setApplyCallId(selectedCall.id); setApplyOpen(true); }}
          onCancelClick={async () => {
            const myApp = applications.find(a => a.worker_id === user?.id);
            if (!myApp) return;
            const { error } = await supabase.from('allocation_applications').delete().eq('id', myApp.id);
            if (error) {
              toast({ title: '취소 실패', description: error.message, variant: 'destructive' });
            } else {
              toast({ title: '신청이 취소되었습니다' });
              fetchCalls();
              fetchCallDetail(selectedCall);
            }
          }}
        />
      ) : (
        <AllocationCallList
          calls={calls}
          isAdmin={isAdmin}
          myApplications={myApplications}
          applicationCounts={applicationCounts}
          onSelectCall={fetchCallDetail}
          onCreateClick={() => setCreateOpen(true)}
          onEditClick={(call) => openEditDialog(call)}
          onDeleteClick={handleDeleteCall}
        />
      )}

      {/* Shared dialogs */}
      <ApplyDialog
        open={applyOpen}
        onOpenChange={v => { if (!v) { setApplyOpen(false); setApplyQuantity(''); setApplyWorkerRef(''); setApplyCallId(null); } }}
        workerRef={applyWorkerRef}
        onWorkerRefChange={setApplyWorkerRef}
        quantity={applyQuantity}
        onQuantityChange={setApplyQuantity}
        onSubmit={handleApply}
      />

      <CallFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        dialogTitle="새 배분 공고"
        title={newTitle}
        onTitleChange={setNewTitle}
        description={newDesc}
        onDescriptionChange={setNewDesc}
        deadline={newDeadline}
        onDeadlineChange={setNewDeadline}
        onSubmit={handleCreateCall}
        submitting={submitting}
        submitLabel="등록"
        titlePlaceholder="예: 3월 15일 라벨링 작업자 모집"
        descPlaceholder="작업 내용, 요구사항 등을 설명하세요"
      />

      <CallFormDialog
        open={editOpen}
        onOpenChange={v => { if (!v) { setEditOpen(false); setEditCall(null); } }}
        dialogTitle="공고 수정"
        title={editTitle}
        onTitleChange={setEditTitle}
        description={editDesc}
        onDescriptionChange={setEditDesc}
        deadline={editDeadline}
        onDeadlineChange={setEditDeadline}
        onSubmit={handleEditCall}
        submitting={submitting}
        submitLabel="저장"
      />
    </div>
  );
}
