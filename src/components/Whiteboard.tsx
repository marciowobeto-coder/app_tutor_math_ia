import { useRef, useState, useEffect, useCallback, TouchEvent, MouseEvent, PointerEvent } from 'react';
import { motion } from 'framer-motion';
import { Eraser, Pen, Trash2, Undo2, Send, Camera } from 'lucide-react';

interface WhiteboardProps {
  onCapture: (imageData: string) => void;
  isAnalyzing?: boolean;
  clearTrigger?: number;
}

type Tool = 'pen' | 'eraser';

const COLORS = [
  'hsl(200, 40%, 10%)',
  'hsl(0, 72%, 55%)',
  'hsl(220, 70%, 55%)',
  'hsl(152, 60%, 42%)',
  'hsl(270, 60%, 55%)',
];

const CANVAS_HEIGHT = 1200;
const SCROLL_TRACK_PADDING = 12;
const MIN_SCROLL_THUMB_HEIGHT = 48;

const Whiteboard = ({ onCapture, isAnalyzing = false, clearTrigger = 0 }: WhiteboardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollGutterRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDraggingScrollbarRef = useRef(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [lineWidth, setLineWidth] = useState(3);
  const [showColors, setShowColors] = useState(false);
  const [scrollThumb, setScrollThumb] = useState({ height: MIN_SCROLL_THUMB_HEIGHT, offset: 0 });
  const historyRef = useRef<ImageData[]>([]);

  const setupCanvas = useCallback((clear = false) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const containerWidth = container.getBoundingClientRect().width;
    const dpr = window.devicePixelRatio || 1;

    let savedData: ImageData | null = null;
    const ctx = canvas.getContext('2d');
    if (!clear && ctx && canvas.width > 0 && canvas.height > 0) {
      savedData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    canvas.width = containerWidth * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;

    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, containerWidth, CANVAS_HEIGHT);

      if (savedData && !clear) {
        ctx.putImageData(savedData, 0, 0);
      }

      ctx.strokeStyle = 'hsl(200, 20%, 92%)';
      ctx.lineWidth = 0.5;
      const gridSize = 24;
      for (let x = gridSize; x < containerWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = gridSize; y < CANVAS_HEIGHT; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(containerWidth, y);
        ctx.stroke();
      }
    }
  }, []);

  const updateScrollThumb = useCallback(() => {
    const container = containerRef.current;
    const gutter = scrollGutterRef.current;
    if (!container || !gutter) return;

    const visibleHeight = container.clientHeight;
    const scrollHeight = container.scrollHeight;
    const trackHeight = Math.max(gutter.clientHeight - SCROLL_TRACK_PADDING * 2, 0);

    if (visibleHeight <= 0 || scrollHeight <= 0 || trackHeight <= 0) return;

    const maxScrollTop = Math.max(scrollHeight - visibleHeight, 0);
    const thumbHeight = Math.min(
      trackHeight,
      Math.max(MIN_SCROLL_THUMB_HEIGHT, (visibleHeight / scrollHeight) * trackHeight),
    );
    const maxThumbOffset = Math.max(trackHeight - thumbHeight, 0);
    const thumbOffset = maxScrollTop === 0 ? 0 : (container.scrollTop / maxScrollTop) * maxThumbOffset;

    setScrollThumb((current) => {
      const nextHeight = Math.round(thumbHeight);
      const nextOffset = Math.round(thumbOffset);

      if (current.height === nextHeight && current.offset === nextOffset) {
        return current;
      }

      return { height: nextHeight, offset: nextOffset };
    });
  }, []);

  const scrollCanvasFromClientY = useCallback((clientY: number) => {
    const container = containerRef.current;
    const gutter = scrollGutterRef.current;
    if (!container || !gutter) return;

    const gutterRect = gutter.getBoundingClientRect();
    const trackTop = gutterRect.top + SCROLL_TRACK_PADDING;
    const trackHeight = Math.max(gutterRect.height - SCROLL_TRACK_PADDING * 2, 0);
    const maxScrollTop = Math.max(container.scrollHeight - container.clientHeight, 0);

    if (trackHeight <= 0 || maxScrollTop <= 0) {
      container.scrollTop = 0;
      return;
    }

    const thumbHeight = Math.min(
      trackHeight,
      Math.max(MIN_SCROLL_THUMB_HEIGHT, (container.clientHeight / container.scrollHeight) * trackHeight),
    );
    const maxThumbOffset = Math.max(trackHeight - thumbHeight, 0);
    const rawOffset = clientY - trackTop - thumbHeight / 2;
    const thumbOffset = Math.min(Math.max(rawOffset, 0), maxThumbOffset);
    const scrollRatio = maxThumbOffset === 0 ? 0 : thumbOffset / maxThumbOffset;

    container.scrollTop = scrollRatio * maxScrollTop;
  }, []);

  useEffect(() => {
    setupCanvas();
    const resizeObserver = new ResizeObserver(() => {
      setupCanvas();
      requestAnimationFrame(updateScrollThumb);
    });

    if (containerRef.current) resizeObserver.observe(containerRef.current);

    requestAnimationFrame(updateScrollThumb);

    return () => resizeObserver.disconnect();
  }, [setupCanvas, updateScrollThumb]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => updateScrollThumb();

    handleScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [updateScrollThumb]);

  useEffect(() => {
    if (clearTrigger > 0) {
      historyRef.current = [];
      setupCanvas(true);
      requestAnimationFrame(() => {
        if (containerRef.current) containerRef.current.scrollTop = 0;
        updateScrollThumb();
      });
    }
  }, [clearTrigger, setupCanvas, updateScrollThumb]);

  const saveHistory = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current.push(data);
    if (historyRef.current.length > 30) historyRef.current.shift();
  };

  const getPos = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) return null;
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    saveHistory();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
    }
  };

  const draw = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getPos(e);
    if (!pos) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.globalCompositeOperation = 'source-over';
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas || historyRef.current.length === 0) return;
    const prev = historyRef.current.pop()!;
    ctx.putImageData(prev, 0, 0);
  };

  const clearCanvas = () => {
    saveHistory();
    setupCanvas(true);
    requestAnimationFrame(() => {
      if (containerRef.current) containerRef.current.scrollTop = 0;
      updateScrollThumb();
    });
  };

  const captureAndSend = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const maxDim = 800;
    const scale = Math.min(maxDim / canvas.width, maxDim / canvas.height, 1);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width * scale;
    tempCanvas.height = canvas.height * scale;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
    onCapture(tempCanvas.toDataURL('image/png'));
  };

  const handlePhotoCapture = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Fotos de celular passam fácil de 4 MB, acima do limite de imagem em base64 dos provedores
    // de IA; reduz para no máx. 1600 px e manda em JPEG.
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.round(img.width * scale);
        tempCanvas.height = Math.round(img.height * scale);
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
          onCapture(dataUrl);
          return;
        }
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        onCapture(tempCanvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => onCapture(dataUrl);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleScrollGutterPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDraggingScrollbarRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    scrollCanvasFromClientY(e.clientY);
  };

  const handleScrollGutterPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingScrollbarRef.current) return;
    e.preventDefault();
    scrollCanvasFromClientY(e.clientY);
  };

  const handleScrollGutterPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    isDraggingScrollbarRef.current = false;
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 p-2 bg-card border-b border-border shrink-0">
        <button
          onClick={() => setTool('pen')}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
            tool === 'pen' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
          title="Caneta"
        >
          <Pen className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTool('eraser')}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
            tool === 'eraser' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
          title="Borracha"
        >
          <Eraser className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-border" />

        <div className="relative">
          <button
            onClick={() => setShowColors(!showColors)}
            className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
            title="Cor"
          >
            <div className="w-5 h-5 rounded-full border-2 border-border" style={{ backgroundColor: color }} />
          </button>
          {showColors && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full mt-1 left-0 bg-card border border-border rounded-lg p-2 flex gap-1.5 z-10 shadow-lg"
            >
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setShowColors(false); }}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    color === c ? 'border-primary scale-110' : 'border-border hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </motion.div>
          )}
        </div>

        <input
          type="range"
          min={1}
          max={8}
          value={lineWidth}
          onChange={e => setLineWidth(Number(e.target.value))}
          className="w-16 accent-primary"
          title="Espessura"
        />

        <div className="w-px h-6 bg-border" />

        <button onClick={undo} className="w-9 h-9 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-secondary/80 transition-colors" title="Desfazer">
          <Undo2 className="w-4 h-4" />
        </button>
        <button onClick={clearCanvas} className="w-9 h-9 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-secondary/80 transition-colors" title="Limpar tudo">
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        <button
          onClick={handlePhotoCapture}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-xl text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-40"
          title="Tirar foto do caderno"
        >
          <Camera className="w-4 h-4" />
          <span className="hidden sm:inline">Foto</span>
        </button>

        <button
          onClick={captureAndSend}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-4 py-2 gradient-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
          {isAnalyzing ? 'Analisando...' : 'Enviar para IA'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex-1 flex overflow-hidden min-h-0">
        <div
          id="whiteboard-scroll-container"
          ref={containerRef}
          className="flex-1 overflow-y-auto overscroll-contain bg-white cursor-crosshair touch-none scrollbar-hidden"
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
            className="block"
          />
        </div>

        <div
          ref={scrollGutterRef}
          className="relative w-10 flex-shrink-0 border-l border-border bg-muted/40 touch-none select-none"
          onPointerDown={handleScrollGutterPointerDown}
          onPointerMove={handleScrollGutterPointerMove}
          onPointerUp={handleScrollGutterPointerEnd}
          onPointerCancel={handleScrollGutterPointerEnd}
          aria-label="Controle de rolagem do quadro"
        >
          <div className="pointer-events-none absolute inset-x-3 top-3 bottom-3 rounded-full bg-background/80" />
          <div
            className="pointer-events-none absolute left-1/2 w-4 rounded-full bg-primary/80 shadow-sm"
            style={{
              height: `${scrollThumb.height}px`,
              transform: `translate(-50%, ${SCROLL_TRACK_PADDING + scrollThumb.offset}px)`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Whiteboard;
