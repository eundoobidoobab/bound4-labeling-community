import { useState, useCallback, useRef, useEffect } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  RotateCw, ZoomIn, Pen, Crop, Undo2, Redo2,
  Eraser, Trash2, Circle, Check, X, Minus,
} from 'lucide-react';

type EditorMode = 'draw' | 'crop';
type DrawTool = 'pen' | 'eraser';

interface DrawPath {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  compositeOp: GlobalCompositeOperation;
}

interface ImageEditorProps {
  open: boolean;
  imageSrc: string;
  onClose: () => void;
  onSave: (blob: Blob) => void;
}

const PEN_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#000000', '#ffffff',
];

const PEN_SIZES = [
  { value: 2, label: '극세' },
  { value: 4, label: '세' },
  { value: 8, label: '중' },
  { value: 14, label: '굵' },
  { value: 24, label: '극굵' },
];

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  return new Promise((resolve) => {
    image.onload = () => resolve(image);
    image.src = src;
  });
}

async function getCroppedImg(
  imageSrc: string, pixelCrop: Area, rotation: number,
  drawPaths: DrawPath[], drawCanvasSize: { w: number; h: number } | null
): Promise<Blob> {
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

  if (drawPaths.length > 0 && drawCanvasSize) {
    const scaleX = bBoxWidth / drawCanvasSize.w;
    const scaleY = bBoxHeight / drawCanvasSize.h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const path of drawPaths) {
      if (path.points.length < 2) continue;
      ctx.globalCompositeOperation = path.compositeOp;
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
    ctx.globalCompositeOperation = 'source-over';
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
  // Default to draw mode since it's most used
  const [mode, setMode] = useState<EditorMode>('draw');
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  // Drawing state
  const [drawPaths, setDrawPaths] = useState<DrawPath[]>([]);
  const [undonePaths, setUndonePaths] = useState<DrawPath[]>([]);
  const [penColor, setPenColor] = useState('#ef4444');
  const [penSize, setPenSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawCanvasSize, setDrawCanvasSize] = useState<{ w: number; h: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

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

  // Redraw canvas
  useEffect(() => {
    if (mode !== 'draw' || !drawCanvasRef.current || !drawCanvasSize) return;
    const canvas = drawCanvasRef.current;
    canvas.width = drawCanvasSize.w;
    canvas.height = drawCanvasSize.h;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const path of drawPaths) {
      if (path.points.length < 2) continue;
      ctx.globalCompositeOperation = path.compositeOp;
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
    ctx.globalCompositeOperation = 'source-over';
  }, [drawPaths, drawCanvasSize, mode]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          // Redo
          setUndonePaths(prev => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            setDrawPaths(p => [...p, last]);
            return prev.slice(0, -1);
          });
        } else {
          // Undo
          setDrawPaths(prev => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            setUndonePaths(p => [...p, last]);
            return prev.slice(0, -1);
          });
        }
      }
      if (e.key === 'e' || e.key === 'E') {
        setDrawTool(prev => prev === 'eraser' ? 'pen' : 'eraser');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

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
    setUndonePaths([]); // Clear redo stack on new stroke
    const newPath: DrawPath = {
      points: [point],
      color: drawTool === 'eraser' ? '#000000' : penColor,
      width: drawTool === 'eraser' ? penSize * 3 : penSize,
      compositeOp: drawTool === 'eraser' ? 'destination-out' : 'source-over',
    };
    setDrawPaths(prev => [...prev, newPath]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    const point = getCanvasPoint(e);
    if (point) setCursorPos(point);
    if (!isDrawing || !point) return;
    setDrawPaths(prev => {
      const updated = [...prev];
      const last = { ...updated[updated.length - 1] };
      last.points = [...last.points, point];
      updated[updated.length - 1] = last;
      return updated;
    });
  };

  const stopDrawing = () => setIsDrawing(false);

  const undoDraw = () => {
    setDrawPaths(prev => {
      if (prev.length === 0) return prev;
      setUndonePaths(p => [...p, prev[prev.length - 1]]);
      return prev.slice(0, -1);
    });
  };

  const redoDraw = () => {
    setUndonePaths(prev => {
      if (prev.length === 0) return prev;
      setDrawPaths(p => [...p, prev[prev.length - 1]]);
      return prev.slice(0, -1);
    });
  };

  const clearAll = () => {
    setUndonePaths([...undonePaths, ...drawPaths]);
    setDrawPaths([]);
  };

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

  const currentSize = drawTool === 'eraser' ? penSize * 3 : penSize;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] p-0 gap-0 overflow-hidden [&>button[class*='absolute']]:hidden">
        {/* Top bar with mode switch and actions */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-card">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setMode('draw')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                mode === 'draw'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Pen className="h-3.5 w-3.5" /> 그리기
            </button>
            <button
              onClick={() => setMode('crop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                mode === 'crop'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Crop className="h-3.5 w-3.5" /> 자르기
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground gap-1">
              <X className="h-4 w-4" /> 취소
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? (
                <span className="animate-pulse">처리 중...</span>
              ) : (
                <>
                  <Check className="h-4 w-4" /> 적용
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Canvas area */}
        <div className="relative bg-black/90">
          <div
            ref={containerRef}
            className="relative w-full"
            style={{ height: 'min(60vh, 480px)' }}
            onMouseLeave={() => setCursorPos(null)}
          >
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
                  className="absolute inset-0 w-full h-full touch-none"
                  style={{ cursor: 'none' }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={(e) => { stopDrawing(); setCursorPos(null); }}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                {/* Custom cursor */}
                {cursorPos && mode === 'draw' && (
                  <div
                    className="pointer-events-none absolute rounded-full border-2 -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: cursorPos.x,
                      top: cursorPos.y,
                      width: currentSize,
                      height: currentSize,
                      borderColor: drawTool === 'eraser' ? 'rgba(255,255,255,0.8)' : penColor,
                      backgroundColor: drawTool === 'eraser' ? 'rgba(255,255,255,0.2)' : `${penColor}33`,
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Draw toolbar - below image */}
        {mode === 'draw' && (
          <div className="flex flex-col items-center bg-card border-t border-border px-3 py-2.5 space-y-2">
              {/* Row 1: Colors */}
              {drawTool === 'pen' && (
                <div className="flex items-center justify-center gap-1.5">
                  {PEN_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setPenColor(c)}
                      className={`w-7 h-7 rounded-full transition-all ${
                        penColor === c
                          ? 'ring-2 ring-offset-2 ring-primary ring-offset-background scale-110'
                          : 'hover:scale-110'
                      }`}
                      style={{
                        backgroundColor: c,
                        boxShadow: c === '#ffffff' ? 'inset 0 0 0 1.5px hsl(var(--border))' : undefined,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Row 2: Tools + Sizes + Actions */}
              <div className="flex items-center justify-center gap-1">
                {/* Pen / Eraser */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setDrawTool('pen')}
                      className={`flex items-center justify-center h-8 w-8 rounded-lg transition-all ${
                        drawTool === 'pen'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <Pen className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>펜</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setDrawTool('eraser')}
                      className={`flex items-center justify-center h-8 w-8 rounded-lg transition-all ${
                        drawTool === 'eraser'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <Eraser className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>지우개 (E)</TooltipContent>
                </Tooltip>

                <div className="h-5 w-px bg-border mx-1" />

                {/* Pen sizes with label */}
                <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg px-1 py-0.5">
                  {PEN_SIZES.map(({ value, label }) => (
                    <Tooltip key={value}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setPenSize(value)}
                          className={`flex items-center justify-center w-7 h-7 rounded-md transition-all ${
                            penSize === value
                              ? 'bg-background shadow-sm'
                              : 'hover:bg-background/50'
                          }`}
                        >
                          <div
                            className="rounded-full bg-foreground"
                            style={{
                              width: Math.max(Math.min(value * 0.8 + 2, 14), 3),
                              height: Math.max(Math.min(value * 0.8 + 2, 14), 3),
                              opacity: penSize === value ? 1 : 0.4,
                            }}
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">{label} ({value}px)</TooltipContent>
                    </Tooltip>
                  ))}
                </div>

                <div className="h-5 w-px bg-border mx-1" />

                {/* Undo / Redo / Clear */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={undoDraw}
                      disabled={drawPaths.length === 0}
                      className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-25 disabled:pointer-events-none transition-all"
                    >
                      <Undo2 className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>실행취소 (⌘Z)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={redoDraw}
                      disabled={undonePaths.length === 0}
                      className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-25 disabled:pointer-events-none transition-all"
                    >
                      <Redo2 className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>다시실행 (⌘⇧Z)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={clearAll}
                      disabled={drawPaths.length === 0}
                      className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-25 disabled:pointer-events-none transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>전체 지우기</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        )}

        {/* Crop controls */}
        {mode === 'crop' && (
          <div className="px-4 py-3 space-y-3 bg-card">
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
            <Button variant="outline" size="sm" onClick={handleRotate}>
              <RotateCw className="h-4 w-4 mr-1" /> 90° 회전
            </Button>
          </div>
        )}

        {/* Stroke count indicator for draw mode */}
        {mode === 'draw' && drawPaths.length > 0 && (
          <div className="px-4 py-2 bg-card border-t border-border">
            <p className="text-xs text-muted-foreground">
              {drawPaths.length}개 획 · <span className="text-foreground/60">Ctrl+Z 실행취소 · E 지우개 전환</span>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
