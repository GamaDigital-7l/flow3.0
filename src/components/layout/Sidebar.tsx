"use client";

import React from 'react';
import { Link, useLocation } from 'react-router-dom'; // Changed from next/link and next/navigation
import { Home, ListTodo, Repeat, Settings, Users, X, LogOut, Calendar, BarChart3, NotebookText, DollarSign, Heart, BookOpen, FileText, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '@/integrations/supabase/auth'; // Importando useSupabaseAuth
import AppLogo from './AppLogo'; 

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <Home className="h-5 w-5" /> },
  { href: '/tasks', label: 'Tarefas', icon: <ListTodo className="h-5 w-5" /> },
  { href: '/recurrence', label: 'Hábitos', icon: <Repeat className="h-5 w-5" /> },
  { href: '/notes', label: 'Notas', icon: <NotebookText className="h-5 w-5" /> },
  { href: '/books', label: 'Biblioteca', icon: <BookOpen className="h-5 w-5" /> },
  { href: '/finance', label: 'Finanças', icon: <DollarSign className="h-5 w-5" /> },
  { href: '/proposals', label: 'Propostas', icon: <FileText className="h-5 w-5" /> },
  { href: '/portfolio', label: 'Portfólio', icon: <Image className="h-5 w-5" /> },
  { href: '/clients', label: 'Clientes', icon: <Users className="h-5 w-5" /> },
  { href: '/health', label: 'Saúde', icon: <Heart className="h-5 w-5" /> },
  { href: '/results', label: 'Resultados', icon: <BarChart3 className="h-5 w-5" /> },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: Event | null;
  onInstallClick: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, deferredPrompt, onInstallClick }) => {
  const location = useLocation();
  const { signOut } = useSupabaseAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <>
      {/* Sidebar Principal */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[250px] bg-sidebar-background border-r border-sidebar-border",
          "flex flex-col transition-transform duration-300 ease-in-out",
          // Esconder no mobile por padrão, mostrar quando isOpen
          "transform lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header da Sidebar */}
        <div className="h-14 flex items-center justify-between p-4 border-b border-sidebar-border pt-[var(--sat)]">
          <Link to="/dashboard" className="flex items-center gap-2">
            <AppLogo />
          </Link>
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navegação Principal */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "nav-link-base",
                location.pathname === item.href ? "nav-link-active" : "nav-link-inactive"
              )}
              onClick={onClose}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer da Sidebar (Configurações e Logout) */}
        <div className="p-4 border-t border-sidebar-border space-y-1 pb-[var(--sab)]">
          {deferredPrompt && (
            <Button
              variant="outline"
              className="w-full justify-start text-primary hover:bg-primary/10 nav-link-base"
              onClick={onInstallClick}
            >
              <Download className="h-5 w-5 mr-2" />
              Instalar App
            </Button>
          )}
          <Link
            to="/settings"
            className={cn(
              "nav-link-base",
              location.pathname === '/settings' ? "nav-link-active" : "nav-link-inactive"
            )}
            onClick={onClose}
          >
            <Settings className="h-5 w-5" />
            <span>Configurações</span>
          </Link>
          
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive nav-link-base"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5 mr-2" />
            Sair
          </Button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;