import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

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
    .createSignedUrl(filePath, 3600);
  if (error || !data?.signedUrl) return '';
  return data.signedUrl;
}

function ImageLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: { url: string; name: string }[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);

  const goNext = useCallback(() => setIndex((i) => (i + 1) % images.length), [images.length]);
  const goPrev = useCallback(() => setIndex((i) => (i - 1 + images.length) % images.length), [images.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, goNext, goPrev]);

  const current = images[index];
  if (!current) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-background/20 p-2 text-white hover:bg-background/40 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Image counter */}
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-sm text-white/70 bg-black/40 px-3 py-1 rounded-full">
          {index + 1} / {images.length}
        </div>
      )}

      {/* Previous */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-4 z-10 rounded-full bg-background/20 p-2 text-white hover:bg-background/40 transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Image */}
      <motion.img
        key={current.url}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        src={current.url}
        alt={current.name}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Next */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-4 z-10 rounded-full bg-background/20 p-2 text-white hover:bg-background/40 transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* File name */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-sm text-white/70 bg-black/40 px-3 py-1 rounded-full max-w-xs truncate">
        {current.name}
      </div>
    </motion.div>
  );
}

export default function FeedAttachments({ attachments }: { attachments: Attachment[] }) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

  const lightboxImages = images
    .map((img) => ({ url: signedUrls[img.id], name: img.file_name }))
    .filter((i) => !!i.url);

  return (
    <div className="mt-3 space-y-2">
      {images.length > 0 && (
        <div className={`grid gap-2 ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {images.map((img, i) => {
            const url = signedUrls[img.id];
            if (!url) return null;
            return (
              <button
                key={img.id}
                onClick={() => setLightboxIndex(i)}
                className="block rounded-lg overflow-hidden border border-border hover:opacity-90 transition-opacity cursor-zoom-in"
              >
                <img src={url} alt={img.file_name} className="w-full h-auto max-h-64 object-cover" loading="lazy" />
              </button>
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

      <AnimatePresence>
        {lightboxIndex !== null && lightboxImages.length > 0 && (
          <ImageLightbox
            images={lightboxImages}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
