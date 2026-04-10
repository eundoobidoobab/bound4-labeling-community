import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Plus } from 'lucide-react';
import type { Project } from '@/types';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (name: string, description: string) => Promise<void>;
}

export function CreateProjectDialog({ open, onOpenChange, onSubmit }: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    await onSubmit(name.trim(), desc.trim());
    setCreating(false);
    setName(''); setDesc('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />새 프로젝트</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>새 프로젝트 생성</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>프로젝트 이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="프로젝트 이름 입력" required />
          </div>
          <div className="space-y-2">
            <Label>프로젝트 설명</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="프로젝트에 대한 간단한 설명을 입력하세요" rows={3} className="resize-none" />
          </div>
          <div className="space-y-2">
            <Label>생성일자</Label>
            <Input value={new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })} disabled className="text-muted-foreground" />
          </div>
          <Button type="submit" className="w-full" disabled={creating}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}생성
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project: Project | null;
  onSubmit: (name: string, description: string) => Promise<void>;
}

export function EditProjectDialog({ open, onOpenChange, project, onSubmit }: EditProjectDialogProps) {
  const [name, setName] = useState(project?.name || '');
  const [desc, setDesc] = useState(project?.description || '');
  const [saving, setSaving] = useState(false);

  // Sync when project changes
  if (project && name === '' && project.name) {
    setName(project.name);
    setDesc(project.description || '');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSubmit(name.trim(), desc.trim());
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setName(''); setDesc(''); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>프로젝트 수정</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>프로젝트 이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>프로젝트 설명</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="resize-none" />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}저장
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ArchiveProjectDialogProps {
  project: Project | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}

export function ArchiveProjectDialog({ project, onOpenChange, onConfirm }: ArchiveProjectDialogProps) {
  return (
    <AlertDialog open={!!project} onOpenChange={(v) => !v && onOpenChange(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>프로젝트 보관</AlertDialogTitle>
          <AlertDialogDescription>
            "{project?.name}" 프로젝트를 보관하시겠습니까? 작업자들은 보관된 프로젝트에 접근할 수 없으며, 관리자만 열람 및 활성화가 가능합니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>보관</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface PermanentDeleteDialogProps {
  project: Project | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => Promise<void>;
}

export function PermanentDeleteDialog({ project, onOpenChange, onConfirm }: PermanentDeleteDialogProps) {
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
    setConfirmName('');
  };

  return (
    <AlertDialog open={!!project} onOpenChange={(v) => { if (!v) { onOpenChange(false); setConfirmName(''); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>프로젝트 영구 삭제</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">"{project?.name}" 프로젝트와 모든 관련 데이터(게시판, 게시글, 댓글, 가이드, 배분, DM 등)가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</span>
            <span className="block text-sm font-medium text-foreground mt-3">확인을 위해 프로젝트 이름을 입력해주세요</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={project?.name || '프로젝트 이름 입력'} className="mt-2" />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={deleting || confirmName !== project?.name} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}영구 삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface JoinProjectDialogProps {
  project: Project | null;
  onOpenChange: (v: boolean) => void;
  onJoin: (role: string) => Promise<void>;
}

export function JoinProjectDialog({ project, onOpenChange, onJoin }: JoinProjectDialogProps) {
  const [joinRole, setJoinRole] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    setJoining(true);
    await onJoin(joinRole.trim());
    setJoining(false);
  };

  return (
    <Dialog open={!!project} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>프로젝트 참여</DialogTitle>
          <DialogDescription>"{project?.name}" 프로젝트에 참여하시겠습니까?</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>역할 (선택)</Label>
            <Input value={joinRole} onChange={(e) => setJoinRole(e.target.value)} placeholder="예: PM, 계약관리, QA 등" />
            <p className="text-xs text-muted-foreground">팀 멤버 목록에 표시되는 역할입니다</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>취소</Button>
            <Button className="flex-1" onClick={handleJoin} disabled={joining}>
              {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}참여하기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userEmail: string;
  isAdmin: boolean;
  onConfirm: () => Promise<void>;
}

export function DeleteAccountDialog({ open, onOpenChange, userEmail, isAdmin, onConfirm }: DeleteAccountDialogProps) {
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setConfirmEmail(''); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>회원 탈퇴</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              {isAdmin
                ? '정말 탈퇴하시겠습니까? 관리자 계정은 동일 이메일로 다시 가입할 수 있습니다.'
                : '정말 탈퇴하시겠습니까? 탈퇴 후 재가입 시 새로운 회원으로 처리되며, 기존 데이터는 복구되지 않습니다.'}
            </span>
            <span className="block text-sm font-medium text-foreground mt-3">확인을 위해 이메일 주소를 입력해주세요</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder={userEmail || '이메일 입력'} className="mt-2" />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={deleting || confirmEmail !== userEmail} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}탈퇴하기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
