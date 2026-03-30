import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, X, ImagePlus, Send, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BugReportComposerProps {
  userDisplayName: string;
  projectId: string;
  onSubmit: (data: {
    title: string;
    body: string;
    data_no: string;
    worker_ref: string;
    capture_image_path: string;
    attachmentPaths: { file_path: string; file_name: string; file_size: number; mime_type: string }[];
  }) => Promise<void>;
}

export default function BugReportComposer({ userDisplayName, projectId, onSubmit }: BugReportComposerProps) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dataNo, setDataNo] = useState('');
  const [workerRef, setWorkerRef] = useState('');
  const [captureFile, setCaptureFile] = useState<{ file: File; preview: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const captureInputRef = useRef<HTMLInputElement>(null);

  const handleCaptureSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (captureFile) URL.revokeObjectURL(captureFile.preview);
      setCaptureFile({ file, preview: URL.createObjectURL(file) });
      if (!expanded) setExpanded(true);
    }
    if (captureInputRef.current) captureInputRef.current.value = '';
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const img = items.find(i => i.type.startsWith('image/'));
    if (img) {
      e.preventDefault();
      const file = img.getAsFile();
      if (file) {
        if (captureFile) URL.revokeObjectURL(captureFile.preview);
        setCaptureFile({ file, preview: URL.createObjectURL(file) });
      }
    }
  }, [captureFile]);

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      let capturePath = '';
      if (captureFile) {
        const ext = captureFile.file.name.split('.').pop();
        const path = `${projectId}/bug-captures/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('board_attachments').upload(path, captureFile.file);
        if (!error) capturePath = path;
      }
      await onSubmit({
        title: title.trim(),
        body: body.trim(),
        data_no: dataNo.trim(),
        worker_ref: workerRef.trim(),
        capture_image_path: capturePath,
        attachmentPaths: [],
      });
      setTitle(''); setBody(''); setDataNo(''); setWorkerRef('');
      if (captureFile) URL.revokeObjectURL(captureFile.preview);
      setCaptureFile(null);
      setExpanded(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setExpanded(false);
    setTitle(''); setBody(''); setDataNo(''); setWorkerRef('');
    if (captureFile) URL.revokeObjectURL(captureFile.preview);
    setCaptureFile(null);
  };

  const initials = userDisplayName.charAt(0).toUpperCase();
  const canSubmit = title.trim() && body.trim();

  return (
    <Card className={`border-2 transition-all duration-200 ${expanded ? 'border-border shadow-md' : 'border-border hover:border-primary/30'}`}>
      <CardContent className="p-4">
        {!expanded ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => setExpanded(true)}
              className="flex-1 text-left rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50 hover:border-primary/20 transition-all"
            >
              버그를 신고하세요...
            </button>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3" onPaste={handlePaste}>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{userDisplayName}</p>
                <p className="text-xs text-muted-foreground">버그 리포트 작성 중</p>
              </div>
            </div>

            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="버그 제목"
              className="text-base font-semibold border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary placeholder:font-normal"
              autoFocus
            />

            {/* Bug-specific fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">데이터 No.</label>
                <Input
                  value={dataNo}
                  onChange={(e) => setDataNo(e.target.value)}
                  placeholder="예: DATA-001"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">작업자 ID</label>
                <Input
                  value={workerRef}
                  onChange={(e) => setWorkerRef(e.target.value)}
                  placeholder="예: hong123"
                  className="text-sm"
                />
              </div>
            </div>

            {/* Capture image */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">캡처 이미지</label>
              <input ref={captureInputRef} type="file" accept="image/*" className="hidden" onChange={handleCaptureSelect} />
              {captureFile ? (
                <div className="relative group rounded-xl overflow-hidden border border-border max-w-xs">
                  <img src={captureFile.preview} alt="캡처" className="w-full h-auto max-h-48 object-contain bg-muted" />
                  <button
                    onClick={() => { URL.revokeObjectURL(captureFile.preview); setCaptureFile(null); }}
                    className="absolute top-1.5 right-1.5 bg-background/90 backdrop-blur-sm rounded-lg p-1.5 shadow-sm hover:bg-destructive hover:text-destructive-foreground transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => captureInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-3 w-full rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all"
                >
                  <Camera className="h-4 w-4" />
                  클릭하여 캡처 이미지를 첨부하거나 Ctrl+V로 붙여넣기
                </button>
              )}
            </div>

            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="버그 상세 내용을 입력하세요..."
              rows={4}
              className="resize-none border-0 px-0 focus-visible:ring-0 placeholder:text-muted-foreground/60 text-sm leading-relaxed"
              onPaste={handlePaste}
            />

            <div className="flex items-center justify-end pt-2 border-t border-border gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel} className="text-muted-foreground">
                취소
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                className="gap-1.5 min-w-[72px]"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-3.5 w-3.5" />등록</>}
              </Button>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
