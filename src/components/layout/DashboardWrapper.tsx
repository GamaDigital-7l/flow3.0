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
      "px-3 sm:px-4 lg:px-6" // Padding responsivo: 12px (mobile) a 24px (desktop)
    )}>
      {children}
    </div>
  );
};

export default DashboardWrapper;