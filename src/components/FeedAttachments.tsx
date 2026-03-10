import { supabase } from '@/integrations/supabase/client';
import { FileText, Download } from 'lucide-react';

interface Attachment {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
}

function getPublicUrl(filePath: string) {
  return supabase.storage.from('board_attachments').getPublicUrl(filePath).data.publicUrl;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function FeedAttachments({ attachments }: { attachments: Attachment[] }) {
  if (!attachments || attachments.length === 0) return null;

  const images = attachments.filter((a) => a.mime_type?.startsWith('image/'));
  const files = attachments.filter((a) => !a.mime_type?.startsWith('image/'));

  return (
    <div className="mt-3 space-y-2">
      {/* Image grid */}
      {images.length > 0 && (
        <div className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {images.map((img) => (
            <a key={img.id} href={getPublicUrl(img.file_path)} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border hover:opacity-90 transition-opacity">
              <img src={getPublicUrl(img.file_path)} alt={img.file_name} className="w-full h-auto max-h-64 object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file) => (
            <a
              key={file.id}
              href={getPublicUrl(file.file_path)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground truncate flex-1">{file.file_name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{formatSize(file.file_size)}</span>
              <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
