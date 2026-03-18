import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

interface EditableContentProps {
  title: string;
  body: string;
  onSave: (title: string, body: string) => Promise<void>;
  onCancel: () => void;
}

export default function EditableContent({ title, body, onSave, onCancel }: EditableContentProps) {
  const [editTitle, setEditTitle] = useState(title);
  const [editBody, setEditBody] = useState(body);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editTitle.trim() || !editBody.trim()) return;
    setSaving(true);
    await onSave(editTitle.trim(), editBody.trim());
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <Input
        value={editTitle}
        onChange={(e) => setEditTitle(e.target.value)}
        placeholder="제목"
        className="text-base font-semibold"
      />
      <Textarea
        value={editBody}
        onChange={(e) => setEditBody(e.target.value)}
        placeholder="내용"
        rows={4}
        className="text-sm"
      />
      <div className="flex items-center gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          <X className="h-4 w-4 mr-1" /> 취소
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving || !editTitle.trim() || !editBody.trim()}>
          <Check className="h-4 w-4 mr-1" /> 저장
        </Button>
      </div>
    </div>
  );
}
