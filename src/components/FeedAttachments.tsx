import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download } from 'lucide-react';

interface Attachment {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function getSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('board_attachments')
    .createSignedUrl(filePath, 3600); // 1 hour expiry
  if (error || !data?.signedUrl) return '';
  return data.signedUrl;
}

export default function FeedAttachments({ attachments }: { attachments: Attachment[] }) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!attachments || attachments.length === 0) return;
    let cancelled = false;

    async function fetchUrls() {
      const urls: Record<string, string> = {};
      await Promise.all(
        attachments.map(async (a) => {
          const url = await getSignedUrl(a.file_path);
          if (url) urls[a.id] = url;
        })
      );
      if (!cancelled) setSignedUrls(urls);
    }

    fetchUrls();
    return () => { cancelled = true; };
  }, [attachments]);

  if (!attachments || attachments.length === 0) return null;

  const images = attachments.filter((a) => a.mime_type?.startsWith('image/'));
  const files = attachments.filter((a) => !a.mime_type?.startsWith('image/'));

  return (
    <div className="mt-3 space-y-2">
      {images.length > 0 && (
        <div className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {images.map((img) => {
            const url = signedUrls[img.id];
            if (!url) return null;
            return (
              <a key={img.id} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border hover:opacity-90 transition-opacity">
                <img src={url} alt={img.file_name} className="w-full h-auto max-h-64 object-cover" loading="lazy" />
              </a>
            );
          })}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file) => {
            const url = signedUrls[file.id];
            if (!url) return null;
            return (
              <a
                key={file.id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground truncate flex-1">{file.file_name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{formatSize(file.file_size)}</span>
                <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
