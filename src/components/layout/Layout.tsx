"use client";

import { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import OfflineIndicator from "../OfflineIndicator";
import QuickAddButton from "../QuickAddButton";

interface LayoutProps {
  isOnline: boolean;
  deferredPrompt: Event | null;
  onInstallClick: () => void;
}

const Layout: React.FC<LayoutProps> = ({ isOnline, deferredPrompt, onInstallClick }) => {
  // Usamos o estado para controlar a abertura do menu lateral (apenas para mobile)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const startLoading = () => setIsLoading(true);
  const stopLoading = () => setIsLoading(true);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
      event.preventDefault();
      navigate('/tasks', { state: { openNewTaskForm: true } });
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
      event.preventDefault();
      navigate('/dashboard');
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      navigate('/settings');
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar para Mobile (Sheet) */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} deferredPrompt={deferredPrompt} onInstallClick={onInstallClick} />
      
      {/* Sidebar Persistente para Desktop (lg:flex) */}
      <div className="hidden lg:flex lg:w-60 flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar-background">
        <div className="flex h-[calc(3.5rem+var(--sat))] items-center border-b border-sidebar-border px-3 pt-[var(--sat)]">
          <h1 className="text-lg font-bold text-sidebar-primary">Gama Flow</h1>
        </div>
        <Sidebar isOpen={true} onClose={() => {}} deferredPrompt={deferredPrompt} onInstallClick={onInstallClick} isDesktop={true} />
      </div>
      
      <div className="flex flex-col flex-1">
        <Header onMenuClick={() => setIsSidebarOpen(true)} deferredPrompt={deferredPrompt} onInstallClick={onInstallClick} />
        <OfflineIndicator isOnline={isOnline} />
        <main className="main-content-area">
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-background/80 z-50"
              >
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </motion.div>
            )}
          </AnimatePresence>
          <Outlet />
        </main>
        <QuickAddButton />
      </div>
    </div>
  );
};

export default Layout;