"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
  // Adicionando props genéricas para permitir onTouchStart/End no mobile
  [key: string]: any; 
}

/**
 * Componente wrapper para aplicar o padrão de largura de 98vw (max-width)
 * e padding lateral responsivo (16px no mobile, 12px no desktop) em todas as páginas.
 */
const PageWrapper: React.FC<PageWrapperProps> = ({ children, className, ...props }) => {
  return (
    <div className={cn(
      "w-full mx-auto",
      "max-w-[98vw]", // Limita a largura máxima a 98% da viewport
      "px-4 md:px-3", // Padding lateral: 16px (p-4) no mobile, 12px (md:p-3) no desktop
      className
    )}
    {...props}
    >
      {children}
    </div>
  );
};

export default PageWrapper;