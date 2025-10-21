"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UseFormReturn } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Session } from "@supabase/supabase-js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ptBR } from "date-fns/locale";

interface SettingsFormValues {
  telegram_bot_token?: string | null;
  telegram_chat_id?: string | null;
  telegram_enabled: boolean;
  notification_channel: "web_push" | "none";
}

interface TelegramSettingsCardProps {
  userId: string | undefined;
  session: Session | null;
  form: UseFormReturn<SettingsFormValues>;
}

const TelegramSettingsCard: React.FC<TelegramSettingsCardProps> = ({ userId, session, form }) => {
  const [isSendingTest, setIsSendingTest] = React.useState(false);

  const telegramEnabled = form.watch("telegram_enabled");
  const telegramBotToken = form.watch("telegram_bot_token");
  const telegramChatId = form.watch("telegram_chat_id");

  const handleSendTestMessage = async () => {
    if (!userId) {
      showError("Usuário não autenticado. Faça login para enviar mensagens de teste.");
      return;
    }
    const botToken = form.getValues("telegram_bot_token");
    const chatId = form.getValues("telegram_chat_id");

    if (!botToken || !chatId) {
      showError("Por favor, configure o Token do Bot e o Chat ID do Telegram.");
      return;
    }

    setIsSendingTest(true);
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Esta é uma mensagem de teste do Nexus Flow!",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.description || "Erro ao enviar mensagem de teste para o Telegram.");
      }

      showSuccess("Mensagem de teste enviada com sucesso para o Telegram!");
    } catch (err: any) {
      showError("Erro ao enviar mensagem de teste para o Telegram: " + err.message);
      console.error("Erro ao enviar mensagem de teste para o Telegram:", err);
    } finally {
      setIsSendingTest(false);
    }
  };

  const areTelegramCredentialsMissing = telegramEnabled && (!telegramBotToken || !telegramChatId);

  return (
    <Card className="w-full max-w-lg bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
      <CardHeader>
        <CardTitle className="text-foreground">Configurações do Telegram</CardTitle>
        <CardDescription className="text-muted-foreground">
          Integre o Nexus Flow com o Telegram para receber notificações.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="telegram_enabled"
              checked={telegramEnabled}
              onCheckedChange={(checked) => form.setValue("telegram_enabled", checked as boolean)}
              className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            />
            <Label htmlFor="telegram_enabled" className="text-foreground">Habilitar Notificações do Telegram</Label>
          </div>

          {areTelegramCredentialsMissing && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Credenciais do Telegram Ausentes!</AlertTitle>
              <AlertDescription>
                Para receber notificações do Telegram, por favor, preencha o Token do Bot e o ID do Chat.
              </AlertDescription>
            </Alert>
          )}

          {telegramEnabled && (
            <>
              <div>
                <Label htmlFor="telegram_bot_token" className="text-foreground">Token do Bot do Telegram</Label>
                <Input
                  id="telegram_bot_token"
                  {...form.register("telegram_bot_token")}
                  placeholder="Seu token do bot (ex: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123456)"
                  className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                />
                {form.formState.errors.telegram_bot_token && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.telegram_bot_token.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="telegram_chat_id" className="text-foreground">ID do Chat do Telegram</Label>
                <Input
                  id="telegram_chat_id"
                  {...form.register("telegram_chat_id")}
                  placeholder="Seu ID de chat (ex: 123456789)"
                  className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                />
                {form.formState.errors.telegram_chat_id && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.telegram_chat_id.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Para obter seu Chat ID, envie uma mensagem para seu bot e depois acesse:
                  <br />
                  `https://api.telegram.org/bot[SEU_TOKEN_DO_BOT]/getUpdates`
                  <br />
                  Procure por <code>"chat":&lcub;"id":...&rcub;</code>
                </p>
              </div>
              <Button
                type="button"
                onClick={handleSendTestMessage}
                disabled={isSendingTest || !telegramBotToken || !telegramChatId}
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
              >
                <Send className="mr-2 h-4 w-4" />
                {isSendingTest ? "Enviando Teste..." : "Enviar Mensagem de Teste"}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TelegramSettingsCard;