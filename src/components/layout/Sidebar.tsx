"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListTodo, Repeat, Settings, Users, X, LogOut, Calendar, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '@/integrations/supabase/auth';
import AppLogo from './AppLogo'; // Importando o novo componente de logo

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: <Home className="h-5 w-5" /> },
  { href: '/tasks', label: 'Todas as Tarefas', icon: <ListTodo className="h-5 w-5" /> },
  { href: '/recurrence', label: 'Recorrência/Hábitos', icon: <Repeat className="h-5 w-5" /> },
  { href: '/calendar', label: 'Calendário', icon: <Calendar className="h-5 w-5" /> },
  { href: '/clients', label: 'Clientes', icon: <Users className="h-5 w-5" /> },
  { href: '/reports', label: 'Relatórios', icon: <BarChart3 className="h-5 w-5" /> },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
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
        <div className="h-14 flex items-center justify-between p-4 border-b border-sidebar-border">
          <Link href="/" className="flex items-center gap-2">
            <AppLogo /> {/* Usando o novo componente de logo */}
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
              href={item.href}
              className={cn(
                "nav-link-base",
                pathname === item.href ? "nav-link-active" : "nav-link-inactive"
              )}
              onClick={onClose} // Fecha a sidebar no mobile ao clicar
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer da Sidebar (Configurações e Logout) */}
        <div className="p-4 border-t border-sidebar-border space-y-1">
          <Link
            href="/settings"
            className={cn(
              "nav-link-base",
              pathname === '/settings' ? "nav-link-active" : "nav-link-inactive"
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