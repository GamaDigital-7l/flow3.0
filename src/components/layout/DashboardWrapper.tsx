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
      "px-2 sm:px-3 lg:px-4" // Padding responsivo reduzido
    )}>
      {children}
    </div>
  );
};

export default DashboardWrapper;