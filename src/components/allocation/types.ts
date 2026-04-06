export interface AllocationCall {
  id: string;
  board_id: string;
  title: string;
  description: string | null;
  work_date: string;
  apply_deadline: string | null;
  created_by: string;
  created_at: string;
  is_closed: boolean;
}

export interface Application {
  id: string;
  call_id: string;
  worker_id: string;
  status: 'APPLIED' | 'SELECTED' | 'REJECTED' | 'WITHDRAWN';
  created_at: string;
  desired_quantity: number | null;
  worker_ref: string | null;
}

export interface Assignment {
  id: string;
  call_id: string;
  worker_id: string;
  status: 'ASSIGNED' | 'DISTRIBUTED_DONE';
  data_ref: string | null;
  assigned_quantity: number | null;
  assigned_at: string;
  distributed_done_at: string | null;
}

export interface Profile {
  id: string;
  display_name: string | null;
  email: string;
}

export interface AllocationBoardProps {
  boardId: string;
  projectId: string;
}

export const getCallStatus = (call: AllocationCall) => {
  if (call.is_closed) return { label: '마감', variant: 'secondary' as const };
  if (!call.apply_deadline) return { label: '모집 중', variant: 'default' as const };
  const now = new Date();
  const deadline = new Date(call.apply_deadline);
  if (now < deadline) return { label: '모집 중', variant: 'default' as const };
  return { label: '마감', variant: 'secondary' as const };
};

export const getAppStatusUI = (status: string) => {
  switch (status) {
    case 'APPLIED': return { label: '할당 전', color: 'text-muted-foreground' };
    case 'SELECTED': return { label: '할당 완료', color: 'text-primary' };
    case 'REJECTED': return { label: '미선발', color: 'text-destructive' };
    case 'WITHDRAWN': return { label: '철회', color: 'text-muted-foreground' };
    default: return { label: status, color: 'text-muted-foreground' };
  }
};

export const getAppStatusIcon = (status: string) => {
  switch (status) {
    case 'APPLIED': return 'Clock';
    case 'SELECTED': return 'CheckCircle2';
    case 'REJECTED': return 'XCircle';
    case 'WITHDRAWN': return 'AlertTriangle';
    default: return 'Clock';
  }
};
