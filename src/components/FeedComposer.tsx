import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, X, ImagePlus, FileUp, Pencil, Send, GripVertical } from 'lucide-react';
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
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const addFiles = useCallback((selected: File[]) => {
    const newFiles: UploadedFile[] = selected.map((file) => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    if (!expanded) setExpanded(true);
  }, [expanded]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) addFiles(droppedFiles);
  };

  // Clipboard paste support for images
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (imageItems.length > 0) {
      e.preventDefault();
      const pastedFiles = imageItems
        .map(item => item.getAsFile())
        .filter((f): f is File => f !== null);
      addFiles(pastedFiles);
    }
  }, [addFiles]);

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

  const handleCancel = () => {
    setExpanded(false);
    setTitle('');
    setBody('');
    files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    setFiles([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const initials = userDisplayName.charAt(0).toUpperCase();
  const editingFile = editingIndex !== null ? files[editingIndex] : null;
  const imageFiles = files.filter(f => f.preview);
  const docFiles = files.filter(f => !f.preview);
  const canSubmit = title.trim() && body.trim();

  return (
    <>
      <Card
        className={`border-2 transition-all duration-200 ${
          dragOver
            ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
            : expanded
              ? 'border-border shadow-md'
              : 'border-border hover:border-primary/30'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <CardContent className="p-4">
          {!expanded ? (
            /* Collapsed state — click to expand */
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => setExpanded(true)}
                className="flex-1 text-left rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50 hover:border-primary/20 transition-all"
              >
                {placeholder}
              </button>
              <div className="flex items-center gap-1">
                <input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10"
                  onClick={() => imageInputRef.current?.click()}
                  title="사진 첨부"
                >
                  <ImagePlus className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ) : (
            /* Expanded state */
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3" onPaste={handlePaste}>
              {/* Header with avatar */}
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{userDisplayName}</p>
                  <p className="text-xs text-muted-foreground">새 글 작성 중</p>
                </div>
              </div>

              {/* Title input */}
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={titlePlaceholder}
                className="text-base font-semibold border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary placeholder:font-normal"
                autoFocus
              />

              {/* Body textarea */}
              <Textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={placeholder}
                rows={4}
                className="resize-none border-0 px-0 focus-visible:ring-0 placeholder:text-muted-foreground/60 text-sm leading-relaxed"
                onPaste={handlePaste}
              />

              {/* Drag & drop hint */}
              <AnimatePresence>
                {dragOver && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center justify-center py-8 rounded-xl border-2 border-dashed border-primary bg-primary/5"
                  >
                    <p className="text-sm font-medium text-primary">여기에 파일을 놓으세요</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Image previews */}
              <AnimatePresence>
                {imageFiles.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className={`grid gap-2 ${
                      imageFiles.length === 1 ? 'grid-cols-1 max-w-xs' :
                      imageFiles.length === 2 ? 'grid-cols-2' :
                      imageFiles.length === 3 ? 'grid-cols-3' :
                      'grid-cols-4'
                    }`}>
                      {imageFiles.map((f) => {
                        const realIndex = files.indexOf(f);
                        return (
                          <motion.div
                            key={realIndex}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="relative group rounded-xl overflow-hidden border border-border aspect-square bg-muted"
                          >
                            <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
                            {/* Overlay with actions */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200">
                              {/* File info at bottom */}
                              <div className="absolute bottom-0 left-0 right-0 p-2">
                                <p className="text-[11px] text-white/80 truncate">{f.file.name}</p>
                                <p className="text-[10px] text-white/60">{formatFileSize(f.file.size)}</p>
                              </div>
                            </div>
                            {/* Action buttons */}
                            <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                              <button
                                onClick={() => setEditingIndex(realIndex)}
                                className="bg-background/90 backdrop-blur-sm rounded-lg p-1.5 shadow-sm hover:bg-background transition-colors"
                                title="편집"
                              >
                                <Pencil className="h-3.5 w-3.5 text-foreground" />
                              </button>
                              <button
                                onClick={() => removeFile(realIndex)}
                                className="bg-background/90 backdrop-blur-sm rounded-lg p-1.5 shadow-sm hover:bg-destructive hover:text-destructive-foreground transition-colors"
                                title="삭제"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Document files */}
              <AnimatePresence>
                {docFiles.length > 0 && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-1.5 overflow-hidden">
                    {docFiles.map((f) => {
                      const realIndex = files.indexOf(f);
                      return (
                        <motion.div
                          key={realIndex}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-muted/30 group hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                            <FileUp className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{f.file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(f.file.size)}</p>
                          </div>
                          <button
                            onClick={() => removeFile(realIndex)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10"
                          >
                            <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toolbar & Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-0.5">
                  <input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => imageInputRef.current?.click()}
                    type="button"
                    className="gap-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10"
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span className="hidden sm:inline">사진</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    className="gap-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10"
                  >
                    <FileUp className="h-4 w-4" />
                    <span className="hidden sm:inline">파일</span>
                  </Button>
                  {files.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {files.length}개 첨부됨
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCancel} className="text-muted-foreground">
                    취소
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={submitting || !canSubmit}
                    className="gap-1.5 min-w-[72px]"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        등록
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

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
