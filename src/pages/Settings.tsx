"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PageWrapper from '@/components/layout/PageWrapper'; // Import PageWrapper

// Schema vazio, pois todas as configurações foram removidas.
const settingsSchema = z.object({});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

const Settings: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {},
  });

  const onSubmit = async () => {
    showSuccess("Configurações salvas com sucesso!");
  };

  return (
    <PageWrapper className="space-y-6">
      <h1 className="text-3xl font-bold">Configurações</h1>
      <p className="text-lg text-muted-foreground">
        Gerencie as configurações do seu aplicativo.
      </p>

      <Card className="w-full max-w-lg bg-card border border-border rounded-xl shadow-sm card-hover-effect">
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
    </PageWrapper>
  );
};

export default Settings;