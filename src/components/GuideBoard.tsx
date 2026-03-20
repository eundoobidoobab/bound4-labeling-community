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
import { motion } from 'framer-motion';
import { Loader2, Upload, FileText, Download, CheckCircle2, Plus, History, Eye, X } from 'lucide-react';
import { formatDateTime } from '@/lib/formatDate';
import { useToast } from '@/hooks/use-toast';

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
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newSummary, setNewSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [versionDialogDoc, setVersionDialogDoc] = useState<GuideDocument | null>(null);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionSummary, setVersionSummary] = useState('');
  const [historyDoc, setHistoryDoc] = useState<GuideDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionFileRef = useRef<HTMLInputElement>(null);

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

      // Fetch profiles
      const authorIds = [...new Set((vers || []).map((v: any) => v.created_by))];
      if (authorIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, display_name, email').in('id', authorIds);
        const profMap: Record<string, Profile> = {};
        (profs || []).forEach((p: any) => { profMap[p.id] = p; });
        setProfiles(profMap);
      }

      // Fetch user's acknowledgements
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

          // Auto-acknowledge: mark unacknowledged latest versions as read
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

  const handleCreateDocument = async () => {
    if (!newTitle.trim() || !newFile || !user) return;
    setSubmitting(true);

    try {
      const ext = newFile.name.split('.').pop();
      const filePath = `${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('guides').upload(filePath, newFile);
      if (uploadError) throw uploadError;

      const { data: doc, error: docError } = await supabase
        .from('guide_documents')
        .insert({ board_id: boardId, title: newTitle.trim() })
        .select()
        .single();
      if (docError) throw docError;

      const { data: version, error: verError } = await supabase
        .from('guide_versions')
        .insert({
          document_id: doc.id,
          version_number: 1,
          file_path: filePath,
          diff_summary: newSummary.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (verError) throw verError;

      await supabase
        .from('project_latest_guide')
        .upsert({
          project_id: projectId,
          guide_version_id: version.id,
        }, { onConflict: 'project_id' });

      // Notify all project members except the creator
      const memberIds = await getProjectMemberIds(projectId, [user.id]);
      await sendNotifications({
        userIds: memberIds,
        type: 'GUIDE_UPDATED',
        title: '새 가이드 문서',
        body: newTitle.trim(),
        projectId,
        deepLink: `/projects/${projectId}/boards/${boardId}`,
      });

      toast({ title: '가이드 문서가 등록되었습니다' });
      setCreateOpen(false);
      setNewTitle('');
      setNewFile(null);
      setNewSummary('');
      fetchData();
    } catch (err: any) {
      toast({ title: '등록 실패', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewVersion = async () => {
    if (!versionFile || !versionDialogDoc || !user) return;
    setSubmitting(true);

    try {
      const currentVersions = versions[versionDialogDoc.id] || [];
      const nextVersion = (currentVersions[0]?.version_number || 0) + 1;

      const ext = versionFile.name.split('.').pop();
      const filePath = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('guides').upload(filePath, versionFile);
      if (uploadError) throw uploadError;

      const { data: version, error: verError } = await supabase
        .from('guide_versions')
        .insert({
          document_id: versionDialogDoc.id,
          version_number: nextVersion,
          file_path: filePath,
          diff_summary: versionSummary.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (verError) throw verError;

      await supabase
        .from('project_latest_guide')
        .upsert({
          project_id: projectId,
          guide_version_id: version.id,
        }, { onConflict: 'project_id' });

      // Notify all project members except the creator
      const memberIds = await getProjectMemberIds(projectId, [user.id]);
      await sendNotifications({
        userIds: memberIds,
        type: 'GUIDE_UPDATED',
        title: '가이드 업데이트',
        body: `"${versionDialogDoc.title}" v${nextVersion}이 등록되었습니다.`,
        projectId,
        deepLink: `/projects/${projectId}/boards/${boardId}`,
      });

      toast({ title: `v${nextVersion}이 등록되었습니다` });
      setVersionDialogDoc(null);
      setVersionFile(null);
      setVersionSummary('');
      fetchData();
    } catch (err: any) {
      toast({ title: '버전 등록 실패', description: err.message, variant: 'destructive' });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Admin: Create new guide */}
      {role === 'admin' && (
        <div className="mb-6">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> 새 가이드 문서
          </Button>
        </div>
      )}

      {/* Guide documents list */}
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
                          <CardTitle className="text-base">{doc.title}</CardTitle>
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
                      {role === 'admin' && (
                        <Button variant="ghost" size="sm" onClick={() => { setVersionDialogDoc(doc); setVersionFile(null); setVersionSummary(''); }}>
                          <Upload className="mr-1 h-3.5 w-3.5" /> 새 버전 업로드
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

      {/* Create document dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 가이드 문서 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>문서 제목</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="예: 라벨링 작업 가이드" />
            </div>
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
            <div className="space-y-2">
              <Label>변경 요약 (선택)</Label>
              <Textarea value={newSummary} onChange={(e) => setNewSummary(e.target.value)} placeholder="이번 가이드의 주요 내용을 간략히 설명하세요" rows={2} className="resize-none" />
            </div>
            <Button className="w-full" onClick={handleCreateDocument} disabled={submitting || !newTitle.trim() || !newFile}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 등록
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New version dialog */}
      <Dialog open={!!versionDialogDoc} onOpenChange={(v) => !v && setVersionDialogDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 버전 업로드 - {versionDialogDoc?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>파일 업로드</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => versionFileRef.current?.click()}
              >
                {versionFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm text-foreground">{versionFile.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">클릭하여 새 파일을 선택하세요</p>
                  </>
                )}
              </div>
              <input ref={versionFileRef} type="file" className="hidden" onChange={(e) => setVersionFile(e.target.files?.[0] || null)} />
            </div>
            <div className="space-y-2">
              <Label>변경 요약</Label>
              <Textarea value={versionSummary} onChange={(e) => setVersionSummary(e.target.value)} placeholder="이전 버전 대비 변경 사항을 설명하세요" rows={2} className="resize-none" />
            </div>
            <Button className="w-full" onClick={handleNewVersion} disabled={submitting || !versionFile}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 업로드
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
