"use client";

import React, { useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number; // Distância em pixels para acionar o refresh
  loadingHeight?: number; // Altura do indicador de loading
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  threshold = 80,
  loadingHeight = 50,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop === 0 && !isRefreshing) {
      setStartY(e.touches[0].clientY);
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY === 0 || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;

    if (distance > 0 && scrollRef.current?.scrollTop === 0) {
      e.preventDefault(); // Previne a rolagem da página subjacente
      setPullDistance(Math.min(distance, threshold * 1.5)); // Limita a distância de puxada
    } else {
      setStartY(0); // Reset se começar a rolar para cima ou não estiver no topo
    }
  }, [startY, isRefreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (isRefreshing) return;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error("Erro durante o pull-to-refresh:", error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        setStartY(0);
      }
    } else {
      setPullDistance(0);
      setStartY(0);
    }
  }, [pullDistance, threshold, onRefresh, isRefreshing]);

  return (
    <div
      ref={scrollRef}
      className="relative h-full w-full overflow-y-auto custom-scrollbar"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ WebkitOverflowScrolling: 'touch' }} // Melhorar a rolagem em iOS
    >
      <AnimatePresence>
        {(isRefreshing || pullDistance > 0) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: isRefreshing ? loadingHeight : pullDistance, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: isRefreshing ? 0.2 : 0.1, ease: "easeOut" }}
            className="absolute top-0 left-0 right-0 flex items-center justify-center overflow-hidden z-10"
            style={{
              height: isRefreshing ? loadingHeight : pullDistance,
              backgroundColor: 'hsl(var(--background))',
            }}
          >
            {isRefreshing ? (
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-6 w-6 text-primary" />
              </motion.div>
            ) : (
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: pullDistance / 2 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
              >
                <Loader2 className={cn("h-6 w-6 text-muted-foreground", pullDistance >= threshold && "text-primary")} />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div
        style={{ transform: `translateY(${pullDistance}px)` }}
        className="transition-transform duration-100 ease-out"
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;