"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, Bell, User, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import Sidebar from './Sidebar';
import { useSession } from '@/integrations/supabase/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePathname } from 'next/navigation';

const Header: React.FC = () => {
  const { session, signOut } = useSession();
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);

  // Lógica de detecção de tema (verifica a classe 'dark' no <html>)
  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkTheme();
    
    // Observa mudanças na classe do <html> (para quando o usuário troca o tema)
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  // Define a fonte da logo baseada no tema
  const logoSrc = isDark ? "/images/Gama Logo - Branca.png" : "/images/Gama-01.png";
  const logoAlt = "Gama Flow Logo";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border h-14 flex items-center px-4 md:px-6 shadow-sm">
      <div className="flex items-center justify-between w-full max-w-[98vw] mx-auto">
        
        {/* Mobile Menu Trigger and Logo */}
        <div className="flex items-center gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px] sm:w-[300px]">
              <Sidebar />
            </SheetContent>
          </Sheet>
          
          {/* Logo Image */}
          <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold">
            <img 
              src={logoSrc} 
              alt={logoAlt} 
              className="h-8 w-auto" // Ajuste o tamanho conforme necessário
            />
          </Link>
        </div>

        {/* Right Side: Notifications and User Menu */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Notifications</span>
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                <Avatar className="h-9 w-9 border-2 border-primary">
                  <AvatarImage src={session?.user?.user_metadata?.avatar_url || "/images/default-avatar.png"} alt={session?.user?.email || "User"} />
                  <AvatarFallback>
                    {session?.user?.email ? session.user.email[0].toUpperCase() : <User className="h-5 w-5" />}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{session?.user?.user_metadata?.first_name || "Usuário"}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {session?.user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
                <User className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;