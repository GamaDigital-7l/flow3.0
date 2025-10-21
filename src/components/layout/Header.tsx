import { Button } from "@/components/ui/button";
import { Menu, Bell, Plus, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSession } from "@/integrations/supabase/auth";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showInfo } from "@/utils/toast";
import React from "react";
import { ThemeToggle } from "../ThemeToggle"; // Importar ThemeToggle

interface HeaderProps {
  onMenuClick: () => void;
  deferredPrompt: Event | null;
  onInstallClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, deferredPrompt, onInstallClick }) => {
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
    <header className="fixed top-0 left-0 right-0 z-40 flex h-[calc(3.5rem+var(--sat))] items-center gap-2 border-b border-border bg-background px-3 lg:px-4 shadow-sm frosted-glass pt-[var(--sat)]">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 h-8 w-8"
        onClick={onMenuClick}
      >
        <Menu className="h-4 w-4" />
        <span className="sr-only">Toggle navigation menu</span>
      </Button>
      <div className="flex-1">
        <Link to="/dashboard" className="text-base font-semibold text-foreground hover:text-primary transition-colors">
          Gama Flow
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle /> {/* Adicionado o botão de troca de tema */}
        {deferredPrompt && (
          <Button variant="ghost" size="icon" onClick={onInstallClick} className="text-primary hover:text-primary-light h-8 w-8">
            <Download className="h-4 w-4" />
            <span className="sr-only">Instalar Aplicativo</span>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-8 w-8">
          <Bell className="h-4 w-4" />
          <span className="sr-only">Notificações</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
              <Avatar className="h-7 w-7">
                <AvatarImage src={session?.user?.user_metadata?.avatar_url || "https://github.com/shadcn.png"} alt="Avatar" />
                <AvatarFallback className="text-xs">{session?.user?.email?.[0]?.toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border border-border text-popover-foreground text-sm">
            <DropdownMenuLabel className="py-1.5 px-2">Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem asChild className="py-1.5 px-2">
              <Link to="/settings" className="cursor-pointer">Configurações</Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer py-1.5 px-2">Suporte</DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive hover:bg-destructive/10 py-1.5 px-2">
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};