import { Button } from "@/components/ui/button";
import { Menu, Bell, Plus, Download, Instagram, MessageSquare, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSession } from "@/integrations/supabase/auth";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showInfo } from "@/utils/toast";
import React from "react";
import { ThemeToggle } from "../ThemeToggle"; // Importar ThemeToggle
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuClick: () => void;
  deferredPrompt: Event | null; // Mantido para compatibilidade com Layout, mas não usado
  onInstallClick: () => void; // Mantido para compatibilidade com Layout, mas não usado
}

const SOCIAL_LINKS = [
  { icon: Instagram, href: "https://instagram.com/gama.creative", label: "Instagram" },
  { icon: Globe, href: "https://gamacreative.com.br", label: "Site" },
  { icon: MessageSquare, href: "https://wa.me/5531999999999", label: "WhatsApp" }, // Placeholder
];

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
    <header className="fixed top-0 left-0 right-0 z-40 flex h-[calc(3.5rem+var(--sat))] items-center gap-2 border-b border-border bg-card px-3 lg:pl-64 lg:pr-4 shadow-sm pt-[var(--sat)]">
      {/* Botão de Menu (Apenas Mobile) */}
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 h-8 w-8 lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-4 w-4" />
        <span className="sr-only">Toggle navigation menu</span>
      </Button>
      
      {/* Branding Gama Flow (Mobile/Fallback) */}
      <div className="flex-1 lg:hidden">
        <Link to="/dashboard" className="text-base font-semibold text-foreground hover:text-primary transition-colors">
          Gama Flow
        </Link>
      </div>
      
      {/* Título da Página (Desktop - Placeholder) */}
      <div className="hidden lg:flex items-center gap-4 flex-shrink-0">
        <h1 className="text-lg font-semibold text-foreground">Dashboard</h1> {/* Pode ser substituído pelo título real da página */}
      </div>

      {/* Links Sociais (Desktop) */}
      <div className="hidden lg:flex items-center gap-1 ml-auto">
        {SOCIAL_LINKS.map(link => {
          const Icon = link.icon;
          return (
            <Button key={link.label} variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-primary">
              <a href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label}>
                <Icon className="h-4 w-4" />
              </a>
            </Button>
          );
        })}
      </div>

      {/* Ações do Usuário */}
      <div className="flex items-center gap-2 ml-auto lg:ml-4">
        <ThemeToggle />
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