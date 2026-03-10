import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Paperclip, X, ImageIcon, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UploadedFile {
  file: File;
  preview?: string;
}

interface FeedComposerProps {
  userDisplayName: string;
  placeholder?: string;
  titlePlaceholder?: string;
  onSubmit: (data: { title: string; body: string; attachmentPaths: { file_path: string; file_name: string; file_size: number; mime_type: string }[] }) => Promise<void>;
}

export default function FeedComposer({ userDisplayName, placeholder = '내용을 입력하세요...', titlePlaceholder = '제목', onSubmit }: FeedComposerProps) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const newFiles: UploadedFile[] = selected.map((file) => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const removed = prev[index];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadFiles = async (): Promise<{ file_path: string; file_name: string; file_size: number; mime_type: string }[]> => {
    const results = [];
    for (const { file } of files) {
      const ext = file.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('board_attachments').upload(path, file);
      if (!error) {
        results.push({
          file_path: path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream',
        });
      }
    }
    return results;
  };

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      const attachmentPaths = files.length > 0 ? await uploadFiles() : [];
      await onSubmit({ title: title.trim(), body: body.trim(), attachmentPaths });
      setTitle('');
      setBody('');
      files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
      setFiles([]);
      setExpanded(false);
    } finally {
      setSubmitting(false);
    }
  };

  const initials = userDisplayName.charAt(0).toUpperCase();

  return (
    <Card className="border border-border">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            {!expanded ? (
              <button
                onClick={() => setExpanded(true)}
                className="w-full text-left rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                {placeholder}
              </button>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={titlePlaceholder}
                  className="font-medium"
                  autoFocus
                />
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={placeholder}
                  rows={3}
                  className="resize-none"
                />

                {/* File previews */}
                <AnimatePresence>
                  {files.length > 0 && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex flex-wrap gap-2">
                      {files.map((f, i) => (
                        <div key={i} className="relative group">
                          {f.preview ? (
                            <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                              <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
                              <button
                                onClick={() => removeFile(i)}
                                className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-3 w-3 text-foreground" />
                              </button>
                            </div>
                          ) : (
                            <div className="relative flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-xs text-foreground truncate max-w-[120px]">{f.file.name}</span>
                              <button onClick={() => removeFile(i)} className="ml-1">
                                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt,.zip"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} type="button">
                      <ImageIcon className="h-4 w-4 mr-1" />
                      이미지
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} type="button">
                      <Paperclip className="h-4 w-4 mr-1" />
                      파일
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setExpanded(false); setTitle(''); setBody(''); setFiles([]); }}>
                      취소
                    </Button>
                    <Button size="sm" onClick={handleSubmit} disabled={submitting || !title.trim() || !body.trim()}>
                      {submitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      등록
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
