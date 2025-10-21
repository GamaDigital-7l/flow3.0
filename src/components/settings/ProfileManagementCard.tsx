"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { ptBR } from "date-fns/locale";

interface ProfileManagementCardProps {
  userId: string | undefined;
  userEmail: string | undefined;
  isUpdatingProfileEmail: boolean;
  setIsUpdatingProfileEmail: React.Dispatch<React.SetStateAction<boolean>>;
  onProfileEmailSynced: () => void;
}

const ProfileManagementCard: React.FC<ProfileManagementCardProps> = ({
  userId,
  userEmail,
  isUpdatingProfileEmail,
  setIsUpdatingProfileEmail,
  onProfileEmailSynced,
}) => {
  const handleUpdateProfileEmail = async () => {
    if (!userId || !userEmail) {
      showError("Usuário não autenticado ou e-mail não disponível.");
      return;
    }
    setIsUpdatingProfileEmail(true);
    try {
      const { data: existingProfile, error: fetchProfileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .single();

      if (fetchProfileError && fetchProfileError.code !== 'PGRST116') {
        throw fetchProfileError;
      }

      if (existingProfile) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ email: userEmail, updated_at: new Date().toISOString() })
          .eq("id", userId);
        if (updateError) throw updateError;
      } else {
        // Se nenhum perfil existir, crie um com o e-mail
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({ id: userId, email: userEmail });
        if (insertError) throw insertError;
      }
      showSuccess("E-mail do perfil sincronizado com sucesso!");
      onProfileEmailSynced();
    } catch (err: any) {
      showError("Erro ao sincronizar e-mail do perfil: " + err.message);
      // console.error("Erro ao sincronizar e-mail do perfil:", err); // Removido console.error
    } finally {
      setIsUpdatingProfileEmail(false);
    }
  };

  return (
    <Card className="w-full max-w-lg bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
      <CardHeader>
        <CardTitle className="text-foreground">Gerenciamento de Perfil</CardTitle>
        <CardDescription className="text-muted-foreground">
          Garanta que seu perfil esteja atualizado para integrações.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="border-b border-border pb-4">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Sincronizar E-mail do Perfil</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Se você está tendo problemas para conectar o Google Calendar, clique aqui para garantir que seu e-mail esteja salvo corretamente no seu perfil.
            </p>
            <Button
              type="button"
              onClick={handleUpdateProfileEmail}
              disabled={isUpdatingProfileEmail || !userEmail}
              className="w-full bg-blue-500 text-white hover:bg-blue-600"
            >
              {isUpdatingProfileEmail ? "Sincronizando..." : "Sincronizar E-mail do Perfil"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileManagementCard;