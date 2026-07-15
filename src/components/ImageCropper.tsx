import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, Check, X, Move, RefreshCw } from 'lucide-react';

interface ImageCropperProps {
  imageSrc: string;
  onCrop: (croppedImageBase64: string) => void;
  onCancel: () => void;
}

export default function ImageCropper({ imageSrc, onCrop, onCancel }: ImageCropperProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });
  const [rotation, setRotation] = useState(0); // Optional rotation: 0, 90, 180, 270

  const containerSize = 256;
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize image sizing when loaded
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const aspect = img.naturalWidth / img.naturalHeight;
      let width = containerSize;
      let height = containerSize;

      if (aspect > 1) {
        // Landscape
        width = containerSize * aspect;
      } else {
        // Portrait
        height = containerSize / aspect;
      }

      setImgDimensions({ width, height });
      // Center the image initially
      setOffset({
        x: (containerSize - width) / 2,
        y: (containerSize - height) / 2
      });
      setZoom(1);
      setRotation(0);
    };
  }, [imageSrc]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - offset.x,
      y: e.touches[0].clientY - offset.y
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  // Handle Rotation
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // Run the crop and compress
  const handleConfirm = () => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = containerSize;
      canvas.height = containerSize;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, containerSize, containerSize);

        // Fill background with white just in case (optional, JPEG doesn't support alpha)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, containerSize, containerSize);

        ctx.save();
        
        // Match the canvas transformation exactly to what is displayed
        // We set transform-origin to 0 0 (top-left) in CSS, so:
        // x_rendered = offset.x + x * zoom
        // y_rendered = offset.y + y * zoom
        
        // Rotation support
        if (rotation !== 0) {
          // Move origin to center of container to rotate
          ctx.translate(containerSize / 2, containerSize / 2);
          ctx.rotate((rotation * Math.PI) / 180);
          
          // Move origin back but adjusted for translated offset
          // To make rotation intuitive, we rotate around container center
          // So let's translate and scale relative to that.
          // However, simpler is drawing directly using our calculated offset.
          // To keep it perfectly matching when rotated, we rotate around the center of the viewport:
          ctx.translate(-containerSize / 2, -containerSize / 2);
        }

        ctx.translate(offset.x, offset.y);
        ctx.scale(zoom, zoom);

        ctx.drawImage(img, 0, 0, imgDimensions.width, imgDimensions.height);
        ctx.restore();

        // Convert to highly optimized JPEG (0.82 quality yields extremely small files, ~15-25KB, ideal!)
        const croppedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        onCrop(croppedBase64);
      }
    };
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-5 flex flex-col items-center">
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-800">Ajustar Foto do Atleta</p>
        <p className="text-xs text-gray-500 mt-1">Arraste a imagem para mover e use o controle deslizante para dar zoom.</p>
      </div>

      {/* Circular Viewport */}
      <div 
        ref={containerRef}
        className="relative w-64 h-64 rounded-full border-4 border-white shadow-xl overflow-hidden cursor-move bg-gray-200 select-none touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUpOrLeave}
      >
        {imageSrc && (
          <img
            ref={imageRef}
            src={imageSrc}
            alt="To Crop"
            draggable={false}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `${imgDimensions.width}px`,
              height: `${imgDimensions.height}px`,
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: '0px 0px',
              maxWidth: 'none',
              maxHeight: 'none',
              pointerEvents: 'none', // Prevent default image drag
              rotate: `${rotation}deg`,
            }}
          />
        )}
        
        {/* Center alignment helper / guide */}
        <div className="absolute inset-0 border border-dashed border-white/40 rounded-full pointer-events-none flex items-center justify-center">
          <div className="w-1/2 h-1/2 border border-dashed border-white/20 rounded-full" />
        </div>
      </div>

      {/* Slider Controls */}
      <div className="w-full max-w-xs space-y-4">
        <div className="flex items-center gap-3">
          <ZoomOut className="h-4 w-4 text-gray-400" />
          <input
            type="range"
            min="1"
            max="4"
            step="0.02"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <ZoomIn className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-mono text-gray-500 w-10 text-right">{Math.round(zoom * 100)}%</span>
        </div>

        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={handleRotate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Girar 90°
          </button>
          
          <button
            type="button"
            onClick={() => {
              setOffset({
                x: (containerSize - imgDimensions.width) / 2,
                y: (containerSize - imgDimensions.height) / 2
              });
              setZoom(1);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
          >
            <Move className="h-3 w-3" />
            Centralizar
          </button>
        </div>
      </div>

      {/* Save / Cancel Buttons */}
      <div className="flex gap-2 w-full pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
        >
          <X className="h-4 w-4 text-red-500" />
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors"
        >
          <Check className="h-4 w-4" />
          Aplicar Foto
        </button>
      </div>
    </div>
  );
}
