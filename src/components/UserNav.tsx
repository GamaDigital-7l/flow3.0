"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/integrations/supabase/auth";
import { useSignOut } from "@/integrations/supabase/queries";
import { LogOut, User } from "lucide-react";
import { toast } from "sonner";

export function UserNav() {
  const { session } = useSession();
  const signOutMutation = useSignOut();

  const handleSignOut = () => {
    signOutMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Você saiu com sucesso!");
        // A UI será atualizada automaticamente pelo hook useSession
      },
      onError: (error) => {
        toast.error("Erro ao sair:", { description: error.message });
      },
    });
  };

  const user = session?.user;
  const userEmail = user?.email || "usuário@exemplo.com";
  const userInitial = userEmail.charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            {/* <AvatarImage src="/avatars/01.png" alt="@shadcn" /> */}
            <AvatarFallback>{userInitial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">Logado como</p>
            <p className="text-xs leading-none text-muted-foreground">
              {userEmail}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}