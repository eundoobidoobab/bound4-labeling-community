import { useEffect, useState, useRef } from 'react';
import { getProjectMemberIds, sendNotifications } from '@/lib/notifications';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, Upload, FileText, Download, CheckCircle2, Plus, History, Eye, MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react';
import { formatDateTime } from '@/lib/formatDate';
import { useToast } from '@/hooks/use-toast';
import { useMembersData } from '@/hooks/useMembersData';

interface GuideDocument {
  id: string;
  title: string;
  board_id: string;
  created_at: string;
}

interface GuideVersion {
  id: string;
  document_id: string;
  version_number: number;
  file_path: string;
  diff_summary: string | null;
  created_by: string;
  created_at: string;
}

interface Profile {
  id: string;
  display_name: string | null;
  email: string;
}

interface GuideBoardProps {
  boardId: string;
  projectId: string;
}

export default function GuideBoard({ boardId, projectId }: GuideBoardProps) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<GuideDocument[]>([]);
  const [versions, setVersions] = useState<Record<string, GuideVersion[]>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [acknowledgements, setAcknowledgements] = useState<Set<string>>(new Set());
  const [downloadCounts, setDownloadCounts] = useState<Record<string, number>>({});
  const [totalWorkers, setTotalWorkers] = useState(0);
  const [loading, setLoading] = useState(true);

  // Download rate modal
  const [downloadModalDoc, setDownloadModalDoc] = useState<GuideDocument | null>(null);
  const [downloadedUsers, setDownloadedUsers] = useState<{ id: string; display_name: string | null; email: string; downloaded_at: string }[]>([]);
  const [allWorkerProfiles, setAllWorkerProfiles] = useState<{ id: string; display_name: string | null; email: string }[]>([]);

  const { data: membersData } = useMembersData(projectId);

  // Unified upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'new' | 'version'>('new');
  const [uploadTargetDoc, setUploadTargetDoc] = useState<GuideDocument | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newSummary, setNewSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [historyDoc, setHistoryDoc] = useState<GuideDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, [boardId]);

  const fetchData = async () => {
    setLoading(true);

    const { data: docs } = await supabase
      .from('guide_documents')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: false });

    const docList = (docs || []) as GuideDocument[];
    setDocuments(docList);

    if (docList.length > 0) {
      const docIds = docList.map(d => d.id);

      const { data: vers } = await supabase
        .from('guide_versions')
        .select('*')
        .in('document_id', docIds)
        .order('version_number', { ascending: false });

      const versionMap: Record<string, GuideVersion[]> = {};
      (vers || []).forEach((v: any) => {
        (versionMap[v.document_id] = versionMap[v.document_id] || []).push(v);
      });
      setVersions(versionMap);

      const authorIds = [...new Set((vers || []).map((v: any) => v.created_by))];
      if (authorIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, display_name, email').in('id', authorIds);
        const profMap: Record<string, Profile> = {};
        (profs || []).forEach((p: any) => { profMap[p.id] = p; });
        setProfiles(profMap);
      }

      if (user) {
        const latestVersionIds = docList.map(d => versionMap[d.id]?.[0]?.id).filter(Boolean);
        if (latestVersionIds.length > 0) {
          const { data: acks } = await supabase
            .from('guide_acknowledgements')
            .select('guide_version_id')
            .eq('user_id', user.id)
            .eq('project_id', projectId)
            .in('guide_version_id', latestVersionIds);
          const existingAcks = new Set((acks || []).map((a: any) => a.guide_version_id));
          setAcknowledgements(existingAcks);

          const unacked = latestVersionIds.filter(id => !existingAcks.has(id));
          if (unacked.length > 0) {
            const inserts = unacked.map(vId => ({
              guide_version_id: vId,
              user_id: user.id,
              project_id: projectId,
            }));
            const { error } = await supabase.from('guide_acknowledgements').insert(inserts);
            if (!error) {
              setAcknowledgements(prev => {
                const next = new Set(prev);
                unacked.forEach(id => next.add(id));
                return next;
              });
            }
          }
        }
      }
    }

    setLoading(false);
  };

  const openUploadDialog = (mode: 'new' | 'version', doc?: GuideDocument) => {
    setUploadMode(mode);
    setUploadTargetDoc(doc || null);
    setNewTitle('');
    setNewFile(null);
    setNewSummary('');
    setUploadOpen(true);
  };

  const handleUploadSubmit = async () => {
    if (!newFile || !user) return;
    setSubmitting(true);

    try {
      const ext = newFile.name.split('.').pop();
      const filePath = `${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('guides').upload(filePath, newFile);
      if (uploadError) throw uploadError;

      if (uploadMode === 'new') {
        if (!newTitle.trim()) return;
        const { data: doc, error: docError } = await supabase
          .from('guide_documents')
          .insert({ board_id: boardId, title: newTitle.trim() })
          .select()
          .single();
        if (docError) throw docError;

        const { data: version, error: verError } = await supabase
          .from('guide_versions')
          .insert({ document_id: doc.id, version_number: 1, file_path: filePath, diff_summary: newSummary.trim() || null, created_by: user.id })
          .select().single();
        if (verError) throw verError;

        await supabase.from('project_latest_guide').upsert({ project_id: projectId, guide_version_id: version.id }, { onConflict: 'project_id' });

        const memberIds = await getProjectMemberIds(projectId, [user.id]);
        await sendNotifications({ userIds: memberIds, type: 'GUIDE_UPDATED', title: `📄 새 가이드: ${newTitle.trim()}`, body: newSummary.trim() || null, projectId, deepLink: `/projects/${projectId}/boards/${boardId}` });
        toast({ title: '가이드 문서가 등록되었습니다' });
      } else {
        if (!uploadTargetDoc) return;
        const currentVersions = versions[uploadTargetDoc.id] || [];
        const nextVersion = (currentVersions[0]?.version_number || 0) + 1;

        const { data: version, error: verError } = await supabase
          .from('guide_versions')
          .insert({ document_id: uploadTargetDoc.id, version_number: nextVersion, file_path: filePath, diff_summary: newSummary.trim() || null, created_by: user.id })
          .select().single();
        if (verError) throw verError;

        await supabase.from('project_latest_guide').upsert({ project_id: projectId, guide_version_id: version.id }, { onConflict: 'project_id' });

        const memberIds = await getProjectMemberIds(projectId, [user.id]);
        await sendNotifications({ userIds: memberIds, type: 'GUIDE_UPDATED', title: `📄 ${uploadTargetDoc.title} v${nextVersion}`, body: newSummary.trim() || '새 버전이 등록되었습니다.', projectId, deepLink: `/projects/${projectId}/boards/${boardId}` });
        toast({ title: `v${nextVersion}이 등록되었습니다` });
      }

      setUploadOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: '등록 실패', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const getFileExt = (filePath: string) => {
    const parts = filePath.split('.');
    return parts.length > 1 ? `.${parts.pop()}` : '';
  };

  const handleDownload = async (filePath: string, fileName?: string) => {
    const { data } = await supabase.storage.from('guides').download(filePath);
    if (data) {
      const ext = getFileExt(filePath);
      const finalName = fileName ? `${fileName}${ext}` : filePath;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalName;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      toast({ title: '다운로드 실패', variant: 'destructive' });
    }
  };

  const handlePreview = async (filePath: string, title?: string) => {
    const { data } = await supabase.storage.from('guides').createSignedUrl(filePath, 300);
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewTitle(title || '미리보기');
    } else {
      toast({ title: '미리보기 실패', variant: 'destructive' });
    }
  };

  const handleUpdateDocTitle = async (docId: string) => {
    if (!editTitle.trim()) return;
    const { error } = await supabase.from('guide_documents').update({ title: editTitle.trim() }).eq('id', docId);
    if (error) {
      toast({ title: '수정 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '문서 제목이 수정되었습니다' });
      setEditingDocId(null);
      fetchData();
    }
  };

  const handleDeleteDocument = async (doc: GuideDocument) => {
    if (!confirm(`"${doc.title}" 문서를 삭제하시겠습니까? 모든 버전이 함께 삭제됩니다.`)) return;
    try {
      const docVersions = versions[doc.id] || [];
      if (docVersions.length > 0) {
        const filePaths = docVersions.map(v => v.file_path);
        await supabase.storage.from('guides').remove(filePaths);
        await supabase.from('guide_versions').delete().eq('document_id', doc.id);
      }
      const versionIds = docVersions.map(v => v.id);
      if (versionIds.length > 0) {
        await supabase.from('project_latest_guide').delete().in('guide_version_id', versionIds);
      }
      const { error } = await supabase.from('guide_documents').delete().eq('id', doc.id);
      if (error) throw error;
      toast({ title: '문서가 삭제되었습니다' });
      fetchData();
    } catch (err: any) {
      toast({ title: '삭제 실패', description: err.message, variant: 'destructive' });
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
      {role === 'admin' && (
        <div className="mb-6">
          <Button onClick={() => openUploadDialog('new')}>
            <Plus className="mr-2 h-4 w-4" /> 가이드 업로드
          </Button>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">등록된 가이드 문서가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {documents.map((doc, i) => {
            const docVersions = versions[doc.id] || [];
            const latest = docVersions[0];
            const author = latest ? profiles[latest.created_by] : null;
            const isAcked = latest ? acknowledgements.has(latest.id) : false;

            return (
              <motion.div key={doc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {editingDocId === doc.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="h-8 text-base font-semibold"
                                onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateDocTitle(doc.id); if (e.key === 'Escape') setEditingDocId(null); }}
                                autoFocus
                              />
                              <Button size="sm" variant="ghost" onClick={() => handleUpdateDocTitle(doc.id)}>저장</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingDocId(null)}>취소</Button>
                            </div>
                          ) : (
                            <CardTitle className="text-base">{doc.title}</CardTitle>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {latest && (
                              <>
                                <Badge variant="outline" className="text-xs">v{latest.version_number}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {author?.display_name || author?.email || '알 수 없음'} · {formatDateTime(latest.created_at)}
                                </span>
                              </>
                            )}
                          </div>
                          {latest?.diff_summary && (
                            <p className="text-sm text-muted-foreground mt-2">{latest.diff_summary}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {latest && isAcked && (
                          <Badge variant="secondary" className="gap-1 text-primary">
                            <CheckCircle2 className="h-3 w-3" /> 확인됨
                          </Badge>
                        )}
                        {role === 'admin' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openUploadDialog('version', doc)}>
                                <Upload className="mr-2 h-4 w-4" />새 버전 업로드
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setEditingDocId(doc.id); setEditTitle(doc.title); }}>
                                <Pencil className="mr-2 h-4 w-4" />제목 수정
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteDocument(doc)}>
                                <Trash2 className="mr-2 h-4 w-4" />삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {latest && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handlePreview(latest.file_path, doc.title)}>
                            <Eye className="mr-1 h-3.5 w-3.5" /> 미리보기
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDownload(latest.file_path, `${doc.title}_v${latest.version_number}`)}>
                            <Download className="mr-1 h-3.5 w-3.5" /> 다운로드
                          </Button>
                        </>
                      )}
                      {docVersions.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => setHistoryDoc(doc)}>
                          <History className="mr-1 h-3.5 w-3.5" /> 버전 이력 ({docVersions.length})
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Unified upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={(v) => { if (!v) setUploadOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {uploadMode === 'version' && uploadTargetDoc
                ? `새 버전 업로드 — ${uploadTargetDoc.title}`
                : '가이드 업로드'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Mode tabs */}
            {documents.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant={uploadMode === 'new' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => { setUploadMode('new'); setUploadTargetDoc(null); }}
                >
                  새 문서
                </Button>
                <Button
                  variant={uploadMode === 'version' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => { setUploadMode('version'); setUploadTargetDoc(null); }}
                >
                  기존 문서에 버전 추가
                </Button>
              </div>
            )}

            {/* Select existing document */}
            {uploadMode === 'version' && !uploadTargetDoc && (
              <div className="space-y-2">
                <Label>대상 문서 선택</Label>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {documents.map(d => (
                    <button
                      key={d.id}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm transition-colors flex items-center gap-2"
                      onClick={() => setUploadTargetDoc(d)}
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{d.title}</span>
                      <Badge variant="outline" className="text-xs ml-auto shrink-0">
                        v{(versions[d.id]?.[0]?.version_number || 0)}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected doc indicator */}
            {uploadMode === 'version' && uploadTargetDoc && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium truncate">{uploadTargetDoc.title}</span>
                <Badge variant="outline" className="text-xs ml-auto">
                  → v{((versions[uploadTargetDoc.id]?.[0]?.version_number || 0) + 1)}
                </Badge>
              </div>
            )}

            {/* Title (new doc only) */}
            {uploadMode === 'new' && (
              <div className="space-y-2">
                <Label>문서 제목</Label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="예: 라벨링 작업 가이드" />
              </div>
            )}

            {/* File upload */}
            <div className="space-y-2">
              <Label>파일 업로드</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {newFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm text-foreground">{newFile.name}</span>
                    <span className="text-xs text-muted-foreground">({(newFile.size / 1024 / 1024).toFixed(1)}MB)</span>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">클릭하여 파일을 선택하세요</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOCX 등 지원</p>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setNewFile(e.target.files?.[0] || null)} />
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <Label>변경 요약 (선택)</Label>
              <Textarea
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                placeholder={uploadMode === 'new' ? '주요 내용을 간략히 설명하세요' : '이전 버전 대비 변경 사항을 설명하세요'}
                rows={2}
                className="resize-none"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleUploadSubmit}
              disabled={submitting || !newFile || (uploadMode === 'new' ? !newTitle.trim() : !uploadTargetDoc)}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploadMode === 'new' ? '등록' : '업로드'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Version history dialog */}
      <Dialog open={!!historyDoc} onOpenChange={(v) => !v && setHistoryDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>버전 이력 - {historyDoc?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-80 overflow-auto">
            {(historyDoc ? versions[historyDoc.id] || [] : []).map((ver) => {
              const author = profiles[ver.created_by];
              return (
                <div key={ver.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <Badge variant="outline">v{ver.version_number}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{ver.diff_summary || '변경 요약 없음'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {author?.display_name || author?.email || '알 수 없음'} · {formatDateTime(ver.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(ver.file_path, `${historyDoc?.title} v${ver.version_number}`)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(ver.file_path, `v${ver.version_number}`)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(v) => !v && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>{previewTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-6 pb-6">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-lg border border-border"
                title={previewTitle}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
