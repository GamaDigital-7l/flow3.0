"use client";

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { cn } from '@/lib/utils';

interface DashboardWrapperProps {
  children: React.ReactNode;
}

/**
 * Componente de layout principal que envolve todas as páginas do dashboard.
 * Inclui o Header fixo, a Sidebar e a área de conteúdo principal.
 */
const DashboardWrapper: React.FC<DashboardWrapperProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex min-h-screen bg-background">
      
      {/* 1. Sidebar (Desktop e Mobile) */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />

      {/* 2. Overlay para Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 3. Conteúdo Principal */}
      <div className={cn(
        "flex flex-col flex-1 transition-all duration-300",
        "lg:ml-[250px]" // Espaço para a sidebar no desktop
      )}>
        
        {/* Header Fixo */}
        <Header onMenuToggle={toggleSidebar} />

        {/* Área de Conteúdo (Main Content Area) */}
        <main className="main-content-area">
          {children}
        </main>
        
      </div>
    </div>
  );
};

export default DashboardWrapper;