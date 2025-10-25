"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PageWrapper from '@/components/layout/PageWrapper'; // Import PageWrapper
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Schema para as configurações, incluindo Telegram
const settingsSchema = z.object({
  telegram_bot_token: z.string().optional(),
  telegram_chat_id: z.string().optional(),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

const Settings: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      telegram_bot_token: process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || "",
      telegram_chat_id: process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || "",
    },
  });

  const onSubmit = async (values: SettingsFormValues) => {
    try {
      // Atualizar as variáveis de ambiente no Supabase
      await supabase.functions.setEnvVariables({
        TELEGRAM_BOT_TOKEN: values.telegram_bot_token,
        TELEGRAM_CHAT_ID: values.telegram_chat_id,
      });
      showSuccess("Configurações salvas com sucesso!");
    } catch (error: any) {
      showError("Erro ao salvar configurações: " + error.message);
    }
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
            Gerencie as configurações do seu aplicativo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="telegram_bot_token">Telegram Bot Token</Label>
              <Input
                id="telegram_bot_token"
                type="text"
                {...form.register("telegram_bot_token")}
                placeholder="Seu Telegram Bot Token"
                className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
              />
            </div>
            <div>
              <Label htmlFor="telegram_chat_id">Telegram Chat ID</Label>
              <Input
                id="telegram_chat_id"
                type="text"
                {...form.register("telegram_chat_id")}
                placeholder="Seu Telegram Chat ID"
                className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
              />
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Salvar Configurações
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageWrapper>
  );
};

export default Settings;