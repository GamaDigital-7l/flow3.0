"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Componente wrapper para aplicar o padrão de largura de 96% (max-width)
 * e padding lateral responsivo (16px no mobile, 24px no desktop) em todas as páginas.
 */
const PageWrapper: React.FC<PageWrapperProps> = ({ children, className }) => {
  return (
    <div className={cn(
      "w-full mx-auto",
      "max-w-[96%]", // Limita a largura máxima a 96% da viewport
      "px-4 md:px-6", // Padding lateral: 16px (p-4) no mobile, 24px (md:p-6) no desktop
      className
    )}>
      {children}
    </div>
  );
};

export default PageWrapper;