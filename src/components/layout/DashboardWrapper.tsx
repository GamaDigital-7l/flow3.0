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
      "max-w-[96%]", // Ocupa 96% da largura total
      "px-3 sm:px-4 lg:px-6" // Padding lateral sutil (12px a 24px)
    )}>
      {children}
    </div>
  );
};

export default DashboardWrapper;