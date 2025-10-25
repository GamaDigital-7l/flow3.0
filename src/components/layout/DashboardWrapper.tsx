import { cn } from '@/lib/utils';
import React from 'react';

interface DashboardWrapperProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Um container de layout que centraliza o conteúdo, aplica um max-width
 * e garante padding lateral responsivo para evitar que o conteúdo
 * toque as bordas da tela.
 */
const DashboardWrapper: React.FC<DashboardWrapperProps> = ({ children, className }) => {
  return (
    <div className={cn(
      'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8', // Container centralizado com max-width e padding de segurança
      className
    )}>
      {children}
    </div>
  );
};

export default DashboardWrapper;