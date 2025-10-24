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
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} deferredPrompt={deferredPrompt} onInstallClick={onInstallClick} />
      <div className="flex flex-col flex-1">
        <Header onMenuClick={() => setIsSidebarOpen(true)} deferredPrompt={deferredPrompt} onInstallClick={onInstallClick} />
        <OfflineIndicator isOnline={isOnline} />
        <main className="main-content-area"> {/* A margem superior é definida em globals.css */}
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
          {/* O Outlet agora renderiza o conteúdo da página, que deve ter seu próprio padding interno */}
          <Outlet />
        </main>
        <QuickAddButton />
      </div>
    </div>
  );
};

export default Layout;