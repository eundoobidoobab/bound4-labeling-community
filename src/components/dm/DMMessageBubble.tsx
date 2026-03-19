import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDateTime } from '@/lib/formatDate';
import { motion } from 'framer-motion';
import { FileText, Download, CheckCheck } from 'lucide-react';

interface Attachment {
  id: string;
  file_path: string;
}

interface MessageProps {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  isMine: boolean;
  senderName: string;
  showAvatar: boolean;
  attachments: Attachment[];
  isRead: boolean;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function DMMessageBubble({
  body, isMine, senderName, showAvatar, attachments, isRead, createdAt,
}: MessageProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, { url: string; name: string; isImage: boolean }>>({});

  useEffect(() => {
    if (!attachments || attachments.length === 0) return;
    let cancelled = false;

    async function fetchUrls() {
      const results: typeof signedUrls = {};
      await Promise.all(
        attachments.map(async (a) => {
          const { data } = await supabase.storage
            .from('dm_attachments')
            .createSignedUrl(a.file_path, 3600);
          if (data?.signedUrl) {
            const name = a.file_path.split('/').pop() || 'file';
            // Remove UUID prefix if present (format: uuid_filename)
            const displayName = name.includes('_') ? name.substring(name.indexOf('_') + 1) : name;
            const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
            results[a.id] = { url: data.signedUrl, name: displayName, isImage };
          }
        })
      );
      if (!cancelled) setSignedUrls(results);
    }

    fetchUrls();
    return () => { cancelled = true; };
  }, [attachments]);

  const images = Object.entries(signedUrls).filter(([, v]) => v.isImage);
  const files = Object.entries(signedUrls).filter(([, v]) => !v.isImage);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}
    >
      {!isMine && (
        <div className="w-8 shrink-0">
          {showAvatar && (
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                {(senderName || '?').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      )}
      <div className={`max-w-[70%] min-w-0 ${isMine ? 'items-end' : 'items-start'}`}>
        {showAvatar && !isMine && (
          <p className="text-xs text-muted-foreground mb-1 ml-1">{senderName}</p>
        )}

        {/* Text bubble */}
        {body && (
          <div
            className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
              isMine
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-muted text-foreground rounded-bl-md'
            }`}
          >
            {body}
          </div>
        )}

        {/* Image attachments */}
        {images.length > 0 && (
          <div className={`mt-1 grid gap-1 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {images.map(([id, { url, name }]) => (
              <a key={id} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border hover:opacity-90 transition-opacity">
                <img src={url} alt={name} className="w-full h-auto max-h-48 object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        )}

        {/* File attachments */}
        {files.length > 0 && (
          <div className="mt-1 space-y-1">
            {files.map(([id, { url, name }]) => (
              <a
                key={id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-foreground truncate flex-1">{name}</span>
                <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </a>
            ))}
          </div>
        )}

        {/* Timestamp + read receipt */}
        <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end mr-1' : 'ml-1'}`}>
          <p className="text-[10px] text-muted-foreground">{formatDateTime(createdAt)}</p>
          {isMine && (
            <CheckCheck className={`h-3 w-3 ${isRead ? 'text-primary' : 'text-muted-foreground/40'}`} />
          )}
        </div>
      </div>
    </motion.div>
  );
}
