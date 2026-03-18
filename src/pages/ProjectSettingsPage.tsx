import { useState } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Settings, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Project, Board } from '@/types';

export default function ProjectSettingsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { project, boards } = useOutletContext<{ project: Project; boards: Board[] }>();
  const { role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [saving, setSaving] = useState(false);

  const isAdmin = role === 'admin';

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        설정 페이지는 관리자만 접근할 수 있습니다.
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('projects')
      .update({ name: name.trim(), description: description.trim() || null } as any)
      .eq('id', projectId!);
    setSaving(false);
    if (error) {
      toast({ title: '저장 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '프로젝트 설정이 저장되었습니다' });
      // Force reload to update sidebar
      window.location.reload();
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          프로젝트 설정
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
          <CardDescription>프로젝트 이름과 설명을 수정할 수 있습니다</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">프로젝트 이름</Label>
              <Input
                id="projectName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="프로젝트 이름"
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectDesc">프로젝트 설명</Label>
              <Textarea
                id="projectDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="프로젝트에 대한 설명을 입력하세요"
                rows={3}
                className="resize-none"
                maxLength={500}
              />
            </div>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              저장
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>게시판 목록</CardTitle>
          <CardDescription>현재 프로젝트에 등록된 게시판입니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {boards.map((board, i) => (
              <div key={board.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-6">{i + 1}</span>
                  <span className="text-sm font-medium text-foreground">{board.name}</span>
                </div>
                <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">{board.type}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
