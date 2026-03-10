import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, X, ImageIcon, FileText, Pencil, Plus, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ImageEditor from '@/components/ImageEditor';

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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((selected: File[]) => {
    const newFiles: UploadedFile[] = selected.map((file) => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    if (e.target === fileInputRef.current) fileInputRef.current!.value = '';
    if (e.target === imageInputRef.current) imageInputRef.current!.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
      if (!expanded) setExpanded(true);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const removed = prev[index];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleImageEdited = (index: number, blob: Blob) => {
    setFiles((prev) => {
      const updated = [...prev];
      const old = updated[index];
      if (old.preview) URL.revokeObjectURL(old.preview);
      const newFile = new File([blob], old.file.name, { type: 'image/jpeg' });
      updated[index] = { file: newFile, preview: URL.createObjectURL(blob) };
      return updated;
    });
    setEditingIndex(null);
  };

  const uploadFiles = async (): Promise<{ file_path: string; file_name: string; file_size: number; mime_type: string }[]> => {
    const results = [];
    for (const { file } of files) {
      const ext = file.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('board_attachments').upload(path, file);
      if (!error) {
        results.push({ file_path: path, file_name: file.name, file_size: file.size, mime_type: file.type || 'application/octet-stream' });
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
  const editingFile = editingIndex !== null ? files[editingIndex] : null;
  const imageFiles = files.filter(f => f.preview);
  const docFiles = files.filter(f => !f.preview);

  return (
    <>
      <Card
        className={`border transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
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
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={titlePlaceholder} className="font-medium" autoFocus />
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} rows={3} className="resize-none" />

                  {/* Image previews - grid layout */}
                  <AnimatePresence>
                    {imageFiles.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className={`grid gap-2 ${imageFiles.length === 1 ? 'grid-cols-1' : imageFiles.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
                      >
                        {imageFiles.map((f, _i) => {
                          const realIndex = files.indexOf(f);
                          return (
                            <div key={realIndex} className="relative group rounded-lg overflow-hidden border border-border aspect-square bg-muted">
                              <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                <button
                                  onClick={() => setEditingIndex(realIndex)}
                                  className="bg-background/90 rounded-full p-2 hover:bg-background transition-colors shadow-sm"
                                  title="편집"
                                >
                                  <Pencil className="h-4 w-4 text-foreground" />
                                </button>
                                <button
                                  onClick={() => removeFile(realIndex)}
                                  className="bg-background/90 rounded-full p-2 hover:bg-destructive/10 transition-colors shadow-sm"
                                  title="삭제"
                                >
                                  <X className="h-4 w-4 text-destructive" />
                                </button>
                              </div>
                              <span className="absolute bottom-1 left-1 text-[10px] text-white bg-black/50 px-1.5 py-0.5 rounded truncate max-w-[90%]">
                                {f.file.name}
                              </span>
                            </div>
                          );
                        })}
                        {/* Add more images button */}
                        <button
                          onClick={() => imageInputRef.current?.click()}
                          className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary"
                        >
                          <Plus className="h-5 w-5" />
                          <span className="text-xs">추가</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Document file list */}
                  <AnimatePresence>
                    {docFiles.length > 0 && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-1.5">
                        {docFiles.map((f) => {
                          const realIndex = files.indexOf(f);
                          return (
                            <div key={realIndex} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 group">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm text-foreground truncate flex-1">{f.file.name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">{(f.file.size / 1024).toFixed(0)}KB</span>
                              <button onClick={() => removeFile(realIndex)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                              </button>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Drop zone hint when no files */}
                  {files.length === 0 && (
                    <div
                      onClick={() => imageInputRef.current?.click()}
                      className="rounded-lg border-2 border-dashed border-border hover:border-primary/50 p-4 text-center cursor-pointer transition-colors group"
                    >
                      <Upload className="h-5 w-5 mx-auto text-muted-foreground group-hover:text-primary transition-colors" />
                      <p className="text-xs text-muted-foreground mt-1.5 group-hover:text-foreground transition-colors">
                        클릭하거나 파일을 드래그하여 첨부하세요
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      <input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
                      <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt,.zip" className="hidden" onChange={handleFileSelect} />
                      <Button variant="ghost" size="sm" onClick={() => imageInputRef.current?.click()} type="button">
                        <ImageIcon className="h-4 w-4 mr-1" /> 이미지
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} type="button">
                        <FileText className="h-4 w-4 mr-1" /> 파일
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setExpanded(false); setTitle(''); setBody(''); setFiles([]); }}>취소</Button>
                      <Button size="sm" onClick={handleSubmit} disabled={submitting || !title.trim() || !body.trim()}>
                        {submitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} 등록
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Image Editor */}
      {editingFile?.preview && editingIndex !== null && (
        <ImageEditor
          open
          imageSrc={editingFile.preview}
          onClose={() => setEditingIndex(null)}
          onSave={(blob) => handleImageEdited(editingIndex, blob)}
        />
      )}
    </>
  );
}
