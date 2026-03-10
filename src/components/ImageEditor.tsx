import { useState, useCallback, useRef, useEffect } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RotateCw, ZoomIn, Pen, Crop, Undo2, Palette } from 'lucide-react';

type EditorMode = 'crop' | 'draw';

interface DrawPath {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface ImageEditorProps {
  open: boolean;
  imageSrc: string;
  onClose: () => void;
  onSave: (blob: Blob) => void;
}

const PEN_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#000000', '#ffffff',
];
const PEN_SIZES = [2, 4, 8, 12];

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  return new Promise((resolve) => {
    image.onload = () => resolve(image);
    image.src = src;
  });
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area, rotation: number, drawPaths: DrawPath[], drawCanvasSize: { w: number; h: number } | null): Promise<Blob> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const bBoxWidth = image.width * cos + image.height * sin;
  const bBoxHeight = image.width * sin + image.height * cos;

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(radians);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  // Draw paths on full-size canvas before cropping
  if (drawPaths.length > 0 && drawCanvasSize) {
    const scaleX = bBoxWidth / drawCanvasSize.w;
    const scaleY = bBoxHeight / drawCanvasSize.h;
    // Reset transform for drawing
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const path of drawPaths) {
      if (path.points.length < 2) continue;
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width * Math.max(scaleX, scaleY);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(path.points[0].x * scaleX, path.points[0].y * scaleY);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x * scaleX, path.points[i].y * scaleY);
      }
      ctx.stroke();
    }
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const data = ctx.getImageData(pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height);
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.putImageData(data, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.92);
  });
}

export default function ImageEditor({ open, imageSrc, onClose, onSave }: ImageEditorProps) {
  const [mode, setMode] = useState<EditorMode>('crop');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  // Drawing state
  const [drawPaths, setDrawPaths] = useState<DrawPath[]>([]);
  const [penColor, setPenColor] = useState('#ef4444');
  const [penSize, setPenSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawCanvasSize, setDrawCanvasSize] = useState<{ w: number; h: number } | null>(null);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  // Set up draw canvas size
  useEffect(() => {
    if (mode === 'draw' && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDrawCanvasSize({ w: rect.width, h: rect.height });
    }
  }, [mode, open]);

  // Redraw canvas when paths change
  useEffect(() => {
    if (mode !== 'draw' || !drawCanvasRef.current || !drawCanvasSize) return;
    const canvas = drawCanvasRef.current;
    canvas.width = drawCanvasSize.w;
    canvas.height = drawCanvasSize.h;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const path of drawPaths) {
      if (path.points.length < 2) continue;
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    }
  }, [drawPaths, drawCanvasSize, mode]);

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const point = getCanvasPoint(e);
    if (!point) return;
    setIsDrawing(true);
    setDrawPaths(prev => [...prev, { points: [point], color: penColor, width: penSize }]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const point = getCanvasPoint(e);
    if (!point) return;
    setDrawPaths(prev => {
      const updated = [...prev];
      const last = { ...updated[updated.length - 1] };
      last.points = [...last.points, point];
      updated[updated.length - 1] = last;
      return updated;
    });
  };

  const stopDrawing = () => setIsDrawing(false);

  const undoDraw = () => setDrawPaths(prev => prev.slice(0, -1));

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation, drawPaths, drawCanvasSize);
      onSave(blob);
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>이미지 편집</DialogTitle>
        </DialogHeader>

        {/* Mode tabs */}
        <div className="flex border-b border-border px-4">
          <button
            onClick={() => setMode('crop')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${mode === 'crop' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Crop className="h-3.5 w-3.5" /> 자르기
          </button>
          <button
            onClick={() => setMode('draw')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${mode === 'draw' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Pen className="h-3.5 w-3.5" /> 그리기
          </button>
        </div>

        {/* Canvas area */}
        <div ref={containerRef} className="relative w-full h-[350px] bg-black">
          {mode === 'crop' ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={undefined}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
            />
          ) : (
            <>
              <img
                src={imageSrc}
                alt="편집 중"
                className="w-full h-full object-contain"
                draggable={false}
              />
              <canvas
                ref={drawCanvasRef}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </>
          )}
        </div>

        {/* Controls */}
        <div className="px-4 py-3 space-y-3">
          {mode === 'crop' ? (
            <>
              {/* Zoom */}
              <div className="flex items-center gap-3">
                <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
                <Slider
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.1}
                  onValueChange={([v]) => setZoom(v)}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-10 text-right">{zoom.toFixed(1)}x</span>
              </div>
              {/* Rotate */}
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={handleRotate}>
                  <RotateCw className="h-4 w-4 mr-1" /> 회전
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Pen controls */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Color swatches */}
                <div className="flex items-center gap-1.5">
                  {PEN_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setPenColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${penColor === c ? 'border-primary scale-110' : 'border-border'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="h-5 w-px bg-border" />
                {/* Pen size */}
                <div className="flex items-center gap-1">
                  {PEN_SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setPenSize(s)}
                      className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${penSize === s ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      <div className="rounded-full bg-current" style={{ width: s + 2, height: s + 2 }} />
                    </button>
                  ))}
                </div>
                <div className="h-5 w-px bg-border" />
                {/* Undo */}
                <Button variant="ghost" size="sm" onClick={undoDraw} disabled={drawPaths.length === 0}>
                  <Undo2 className="h-4 w-4 mr-1" /> 실행취소
                </Button>
              </div>
            </>
          )}

          {/* Save / Cancel */}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? '처리 중...' : '적용'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
