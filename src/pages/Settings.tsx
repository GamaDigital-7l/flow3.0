"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import ProfileManagementCard from "@/components/settings/ProfileManagementCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Schema vazio, pois todas as configurações foram removidas.
const settingsSchema = z.object({});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

const Settings: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  const [isUpdatingProfileEmail, setIsUpdatingProfileEmail] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {},
  });

  // Função para garantir que o email do perfil esteja sincronizado (mantida por segurança)
  const fetchProfileEmailStatus = useCallback(async () => {
    // Esta função agora só serve para ser chamada após a sincronização do email
    // A lógica de fetch de status de integração foi removida.
  }, []);

  useEffect(() => {
    // Apenas para garantir que o ProfileManagementCard funcione
    fetchProfileEmailStatus();
  }, [fetchProfileEmailStatus]);

  const onSubmit = async () => {
    showSuccess("Configurações salvas com sucesso!");
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 bg-background text-foreground">
      <h1 className="text-3xl font-bold">Configurações</h1>
      <p className="text-lg text-muted-foreground">
        Gerencie as configurações do seu aplicativo.
      </p>

      <ProfileManagementCard
        userId={userId}
        userEmail={userEmail}
        isUpdatingProfileEmail={isUpdatingProfileEmail}
        setIsUpdatingProfileEmail={setIsUpdatingProfileEmail}
        onProfileEmailSynced={fetchProfileEmailStatus}
      />

      <Card className="w-full max-w-lg bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-foreground">Configurações Gerais</CardTitle>
          <CardDescription className="text-muted-foreground">
            Nenhuma configuração adicional disponível no momento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Todas as integrações e configurações avançadas foram removidas.
          </p>
        </CardContent>
      </Card>

      <Button type="submit" onClick={onSubmit} className="w-full max-w-lg bg-primary text-primary-foreground hover:bg-primary/90 self-center mt-6">
        Salvar Configurações
      </Button>
    </div>
  );
};

export default Settings;