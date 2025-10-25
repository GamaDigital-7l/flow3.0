// src/components/layout/DashboardWrapper.tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface DashboardWrapperProps {
  children: React.ReactNode;
}

// Define o container principal centralizado com padding responsivo
const DashboardWrapper: React.FC<DashboardWrapperProps> = ({ children }) => {
  return (
    <div className={cn(
      "w-full mx-auto",
      "max-w-screen-xl", // Exemplo de max-width (1280px)
      "px-4 sm:px-6 lg:px-8" // Padding responsivo: 16px (mobile) a 32px (desktop)
    )}>
      {children}
    </div>
  );
};

export default DashboardWrapper;