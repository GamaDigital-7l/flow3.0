"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Link as LinkIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante
import { cn } from "@/lib/utils"; // Importando as novas funções
import { sendDailyTelegramSummary } from "@/utils/telegram";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import PageWrapper from '@/components/layout/PageWrapper'; // Import PageWrapper

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
  const queryClient = useQueryClient();

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
          <Form {...form}>
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
            </form>
          </Form>
        </CardContent>
      </Card>
    </PageWrapper>
  );
};

export default Settings;