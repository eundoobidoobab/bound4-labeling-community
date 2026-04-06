import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, UserCheck } from 'lucide-react';

interface ApplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerRef: string;
  onWorkerRefChange: (v: string) => void;
  quantity: string;
  onQuantityChange: (v: string) => void;
  onSubmit: () => void;
}

export function ApplyDialog({ open, onOpenChange, workerRef, onWorkerRefChange, quantity, onQuantityChange, onSubmit }: ApplyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>작업 신청</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>작업자 ID</Label>
            <Input value={workerRef} onChange={e => onWorkerRefChange(e.target.value)} placeholder="본인의 작업자 ID를 입력하세요" />
          </div>
          <div className="space-y-2">
            <Label>희망 수량 (선택)</Label>
            <Input type="number" min="1" value={quantity} onChange={e => onQuantityChange(e.target.value)} placeholder="배분 받고 싶은 수량을 입력하세요" />
            <p className="text-xs text-muted-foreground">입력하지 않으면 관리자가 수량을 결정합니다</p>
          </div>
          <Button className="w-full" onClick={onSubmit}>
            <UserCheck className="mr-2 h-4 w-4" /> 신청하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CallFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  dialogTitle: string;
  onTitleChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  deadline: string;
  onDeadlineChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
  titlePlaceholder?: string;
  descPlaceholder?: string;
}

export function CallFormDialog({
  open, onOpenChange, title, dialogTitle, onTitleChange, description, onDescriptionChange,
  deadline, onDeadlineChange, onSubmit, submitting, submitLabel, titlePlaceholder, descPlaceholder,
}: CallFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>공고 제목</Label>
            <Input value={title} onChange={e => onTitleChange(e.target.value)} placeholder={titlePlaceholder} />
          </div>
          <div className="space-y-2">
            <Label>설명 (선택)</Label>
            <Textarea value={description} onChange={e => onDescriptionChange(e.target.value)} placeholder={descPlaceholder} rows={3} className="resize-none" />
          </div>
          <div className="space-y-2">
            <Label>신청 마감 (선택)</Label>
            <Input type="datetime-local" value={deadline} onChange={e => onDeadlineChange(e.target.value)} />
            <p className="text-xs text-muted-foreground">설정하면 마감일이 지나면 자동으로 신청이 마감됩니다</p>
          </div>
          <Button className="w-full" onClick={onSubmit} disabled={submitting || !title.trim()}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
