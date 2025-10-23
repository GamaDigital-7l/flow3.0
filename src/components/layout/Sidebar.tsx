import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, ListTodo, Target, BookOpen, Dumbbell, Notebook, CalendarDays, Users, BarChart3, Settings, DollarSign, Repeat, Download, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSession } from "@/integrations/supabase/auth";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: Event | null;
  onInstallClick: () => void;
}

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Tarefas", href: "/tasks", icon: ListTodo },
  { name: "Recorrentes", href: "/recurring", icon: Repeat },
  { name: "Financeiro", href: "/finance", icon: DollarSign },
  { name: "Metas", href: "/goals", icon: Target },
  { name: "Saúde", href: "/health", icon: Dumbbell },
  { name: "Estudos", href: "/study", icon: GraduationCap },
  { name: "Livros", href: "/books", icon: BookOpen },
  { name: "Notas", href: "/notes", icon: Notebook },
  { name: "Resultados", href: "/results", icon: BarChart3 },
  // { name: "Briefing", href: "/briefing", icon: ListTodo }, // REMOVIDO
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, deferredPrompt, onInstallClick }) => {
  const location = useLocation();
  const { session } = useSession();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      showSuccess("Desconectado com sucesso!");
    } catch (error: any) {
      showError("Erro ao desconectar: " + error.message);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="left" 
        className="flex flex-col w-60 bg-sidebar-background border-r border-sidebar-border p-0"
      >
        <div className="flex h-[calc(3.5rem+var(--sat))] items-center border-b border-sidebar-border px-3 pt-[var(--sat)]">
          <h1 className="text-lg font-bold text-sidebar-primary">Gama Flow</h1>
        </div>
        <ScrollArea className="flex-1 overflow-y-auto p-3">
          <nav className="grid gap-1.5 text-sm font-medium">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={onClose}
                  className={cn(
                    "nav-link-base",
                    isActive ? "nav-link-active" : "nav-link-inactive"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>
        <div className="p-3 border-t border-sidebar-border space-y-1.5">
          <Link to="/settings" onClick={onClose}>
            <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent h-9 px-3 text-sm">
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </Button>
          </Link>
          {deferredPrompt && (
            <Button onClick={onInstallClick} className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 h-9 px-3 text-sm">
              <Download className="mr-2 h-4 w-4" />
              Instalar App
            </Button>
          )}
          <Button onClick={handleLogout} variant="destructive" className="w-full h-9 px-3 text-sm">
            Sair
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};