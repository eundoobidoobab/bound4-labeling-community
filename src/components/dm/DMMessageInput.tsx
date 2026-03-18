import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Paperclip, X, FileText } from 'lucide-react';

interface AttachedFile {
  file: File;
  preview?: string;
}

interface DMMessageInputProps {
  onSend: (body: string, files: File[]) => Promise<void>;
  disabled?: boolean;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function DMMessageInput({ onSend, disabled }: DMMessageInputProps) {
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: FileList | File[]) => {
    const added: AttachedFile[] = Array.from(newFiles).map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setFiles(prev => [...prev, ...added]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const f = prev[index];
      if (f.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSend = async () => {
    if ((!body.trim() && files.length === 0) || sending) return;
    setSending(true);
    try {
      await onSend(body.trim(), files.map(f => f.file));
      setBody('');
      files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
      setFiles([]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  return (
    <div
      className="p-4 border-t border-border bg-card shrink-0"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="max-w-2xl mx-auto space-y-2">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <div key={i} className="relative group">
                {f.preview ? (
                  <img src={f.preview} alt={f.file.name} className="h-16 w-16 rounded-lg object-cover border border-border" />
                ) : (
                  <div className="h-16 px-3 flex items-center gap-2 rounded-lg border border-border bg-muted/30">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="max-w-[120px]">
                      <p className="text-xs text-foreground truncate">{f.file.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatSize(f.file.size)}</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => removeFile(i)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            rows={1}
            className="resize-none min-h-[40px] text-sm"
            disabled={disabled}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={sending || (!body.trim() && files.length === 0)}
            className="h-10 w-10 shrink-0"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
