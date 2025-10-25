"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showInfo } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PageWrapper from '@/components/layout/PageWrapper'; // Import PageWrapper
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { sendDailyTelegramSummary } from "@/utils/telegram";
import axios from "axios";

// Schema para as configurações, incluindo Telegram e WhatsApp
const settingsSchema = z.object({
  telegram_bot_token: z.string().optional(),
  telegram_chat_id: z.string().optional(),
  whatsapp_api_token: z.string().optional(),
  whatsapp_phone_number_id: z.string().optional(),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

const Settings: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: userSettings, isLoading, error, refetch } = useQuery({
    queryKey: ['userSettings', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('telegram_bot_token, telegram_chat_id, whatsapp_api_token, whatsapp_phone_number_id')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      return data || {};
    },
    enabled: !!userId,
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      telegram_bot_token: userSettings?.telegram_bot_token || "",
      telegram_chat_id: userSettings?.telegram_chat_id || "",
      whatsapp_api_token: userSettings?.whatsapp_api_token || "",
      whatsapp_phone_number_id: userSettings?.whatsapp_phone_number_id || "",
    },
    values: userSettings,
    resetOptions: {
      keepDirty: true,
    }
  });

  useEffect(() => {
    if (userSettings) {
      form.reset(userSettings);
    }
  }, [userSettings, form]);

  const onSubmit = async (values: SettingsFormValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: userId,
            telegram_bot_token: values.telegram_bot_token,
            telegram_chat_id: values.telegram_chat_id,
            whatsapp_api_token: values.whatsapp_api_token,
            whatsapp_phone_number_id: values.whatsapp_phone_number_id,
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        throw error;
      }

      showSuccess("Configurações salvas com sucesso!");
      refetch();
    } catch (error: any) {
      showError("Erro ao salvar configurações: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestWhatsApp = async () => {
    const whatsappApiToken = form.getValues('whatsapp_api_token');
    const whatsappPhoneNumberId = form.getValues('whatsapp_phone_number_id');

    if (!whatsappApiToken || !whatsappPhoneNumberId) {
      showError("Por favor, preencha o token e o ID do número do WhatsApp.");
      return;
    }

    try {
      const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
      const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

      if (!evolutionApiUrl || !evolutionApiKey) {
        showError("URL ou chave da API Evolution não configuradas.");
        return;
      }

      const testMessage = "Teste de mensagem da Gama Flow!";

      const evolutionResponse = await axios.post(evolutionApiUrl, {
        phone: whatsappPhoneNumberId,
        message: testMessage,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${evolutionApiKey}`,
        },
      });

      if (evolutionResponse.status === 200) {
        showSuccess("Mensagem de teste enviada para o WhatsApp!");
      } else {
        showError("Erro ao enviar mensagem de teste para o WhatsApp.");
        console.error("Erro na resposta da Evolution API:", evolutionResponse.status, evolutionResponse.data);
      }
    } catch (error: any) {
      showError("Erro ao enviar mensagem de teste para o WhatsApp: " + error.message);
      console.error("Erro ao enviar mensagem de teste para o WhatsApp:", error);
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
            <div>
              <Label htmlFor="whatsapp_api_token">WhatsApp Business API Token</Label>
              <Input
                id="whatsapp_api_token"
                type="text"
                {...form.register("whatsapp_api_token")}
                placeholder="Seu WhatsApp Business API Token"
                className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
              />
            </div>
            <div>
              <Label htmlFor="whatsapp_phone_number_id">WhatsApp Phone Number ID</Label>
              <Input
                id="whatsapp_phone_number_id"
                type="text"
                {...form.register("whatsapp_phone_number_id")}
                placeholder="Seu WhatsApp Phone Number ID"
                className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
              />
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar Configurações"}
            </Button>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                onClick={() => sendDailyTelegramSummary(userId, 'morning')}
                disabled={isSubmitting}
                className="w-full bg-green-500 text-white hover:bg-green-700"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enviar Teste Telegram (Manhã)"}
              </Button>
              <Button
                type="button"
                onClick={() => sendDailyTelegramSummary(userId, 'evening')}
                disabled={isSubmitting}
                className="w-full bg-green-500 text-white hover:bg-green-700"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enviar Teste Telegram (Noite)"}
              </Button>
              <Button
                type="button"
                onClick={handleTestWhatsApp}
                disabled={isSubmitting}
                className="w-full bg-blue-500 text-white hover:bg-blue-700"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enviar Teste WhatsApp"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Para configurar o Telegram, você precisa adicionar o token e o chat ID no console do Supabase.
            </p>
            <p className="text-xs text-muted-foreground">
              Para configurar o WhatsApp, você precisa adicionar o token e o ID do número de telefone no console do Supabase.
            </p>
          </form>
        </CardContent>
      </Card>
    </PageWrapper>
  );
};

export default Settings;