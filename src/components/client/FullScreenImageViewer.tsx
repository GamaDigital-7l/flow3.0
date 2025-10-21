"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FullScreenImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrls: string[]; // Alterado para array de URLs
  initialIndex: number; // Novo: índice da imagem inicial
  description?: string | null;
}

const FullScreenImageViewer: React.FC<FullScreenImageViewerProps> = ({ isOpen, onClose, imageUrls, initialIndex, description }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isImageLoading, setIsImageLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  useEffect(() => {
    if (isOpen) {
      setIsImageLoading(true);
    }
  }, [currentIndex, isOpen]);

  if (!isOpen || imageUrls.length === 0) return null;

  const currentImageUrl = imageUrls[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? imageUrls.length - 1 : prevIndex - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex === imageUrls.length - 1 ? 0 : prevIndex + 1));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed inset-0 flex flex-col items-center justify-center bg-black bg-opacity-95 z-50 p-0 border-none rounded-none max-w-full max-h-full h-full w-full animate-fade-in-slide-up dialog-content-mobile-full">
        <DialogHeader className="sr-only">
          <DialogTitle>Visualizador de Imagem</DialogTitle>
          <DialogDescription>Visualizando a imagem em tela cheia. Use as setas para navegar entre as imagens.</DialogDescription>
        </DialogHeader>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
        >
          <X className="h-6 w-6" />
          <span className="sr-only">Fechar</span>
        </Button>

        {imageUrls.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20"
            >
              <ChevronLeft className="h-8 w-8" />
              <span className="sr-only">Anterior</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20"
            >
              <ChevronRight className="h-8 w-8" />
              <span className="sr-only">Próxima</span>
            </Button>
          </>
        )}

        <div className="relative flex flex-col items-center justify-center h-full w-full p-4">
          {isImageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          )}
          <img
            src={currentImageUrl}
            alt={description || "Imagem da tarefa"}
            className={cn("max-w-full max-h-[80vh] object-contain transition-opacity duration-300", isImageLoading ? "opacity-0" : "opacity-100")}
            loading="lazy"
            onLoad={() => setIsImageLoading(false)}
            onError={(e) => {
              e.currentTarget.src = '/placeholder.svg';
              setIsImageLoading(false);
            }}
          />
          {description && (
            <div className="mt-4 p-3 bg-gray-800 bg-opacity-70 rounded-md text-white text-center max-w-full overflow-auto break-words">
              <p className="text-sm">{description}</p>
            </div>
          )}
          {imageUrls.length > 1 && (
            <div className="absolute bottom-4 text-white bg-black/50 px-3 py-1 rounded-full text-sm">
              {currentIndex + 1} / {imageUrls.length}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FullScreenImageViewer;