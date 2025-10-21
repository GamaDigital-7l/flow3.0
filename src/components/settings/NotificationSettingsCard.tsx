"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BellRing, Sun, CalendarCheck } from "lucide-react";
import WebPushToggle from "@/components/WebPushToggle";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { UseFormReturn } from "react-hook-form";
import { Session } from "@supabase/supabase-js";
import TimePicker from "../TimePicker";
import { ptBR } from "date-fns/locale";

interface SettingsFormValues {
  groq_api_key?: string | null;
  openai_api_key?: string | null;
  ai_provider_preference: "groq" | "openai";
  notification_channel: "web_push" | "none";
  telegram_enabled: boolean;
  daily_brief_morning_time: string;
  daily_brief_evening_time: string;
  weekly_brief_day: string;
  weekly_brief_time: string;
}

interface NotificationSettingsCardProps {
  userId: string | undefined;
  session: Session | null;
  form: UseFormReturn<SettingsFormValues>;
}

const DAYS_OF_WEEK_OPTIONS = [
  { value: "Sunday", label: "Domingo" },
  { value: "Monday", label: "Segunda-feira" },
  { value: "Tuesday", label: "Terça-feira" },
  { value: "Wednesday", label: "Quarta-feira" },
  { value: "Thursday", label: "Quinta-feira" },
  { value: "Friday", label: "Sexta-feira" },
  { value: "Saturday", label: "Sábado" },
];

const NotificationSettingsCard: React.FC<NotificationSettingsCardProps> = ({
  userId,
  session,
  form,
}) => {
  const [isSendingTest, setIsSendingTest] = React.useState(false);
  const [isSendingDailyBriefTest, setIsSendingDailyBriefTest] = React.useState(false);
  const [isSendingWeeklyBriefTest, setIsSendingWeeklyBriefTest] = React.useState(false);

  const notificationChannel = form.watch("notification_channel");
  const telegramEnabled = form.watch("telegram_enabled");

  const handleSendTestNotification = async () => {
    if (!userId) {
      showError("Usuário não autenticado. Faça login para enviar notificações de teste.");
      return;
    }
    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('daily-brief', {
        body: { timeOfDay: 'test_notification' },
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (error) {
        throw error;
      }
      showSuccess("Notificação de teste enviada com sucesso! Verifique seu navegador/celular.");
      // console.log("Resposta da notificação de teste:", data); // Removido console.log
    } catch (err: any) {
      showError("Erro ao enviar notificação de teste: " + err.message);
      // console.error("Erro ao enviar notificação de teste:", err); // Removido console.error
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSendDailyBriefTest = async () => {
    if (!userId) {
      showError("Usuário não autenticado. Faça login para enviar o brief da manhã.");
      return;
    }
    setIsSendingDailyBriefTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('daily-brief', {
        body: { timeOfDay: 'morning' },
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (error) {
        throw error;
      }
      showSuccess("Brief da manhã enviado com sucesso! Verifique seu navegador/celular.");
      // console.log("Resposta do brief da manhã:", data); // Removido console.log
    } catch (err: any) {
      showError("Erro ao enviar brief da manhã: " + err.message);
      // console.error("Erro ao enviar brief da manhã:", err); // Removido console.error
    } finally {
      setIsSendingDailyBriefTest(false);
    }
  };

  const handleSendWeeklyBriefTest = async () => {
    if (!userId) {
      showError("Usuário não autenticado. Faça login para enviar o resumo semanal.");
      return;
    }
    setIsSendingWeeklyBriefTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('weekly-brief', {
        body: { type: 'weekly_brief' },
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (error) {
        throw error;
      }
      showSuccess("Resumo semanal enviado com sucesso! Verifique seu navegador/celular.");
      // console.log("Resposta do resumo semanal:", data); // Removido console.log
    } catch (err: any) {
      showError("Erro ao enviar resumo semanal: " + err.message);
      // console.error("Erro ao enviar resumo semanal:", err); // Removido console.error
    } finally {
      setIsSendingWeeklyBriefTest(false);
    }
  };

  const isAnyNotificationChannelEnabled = notificationChannel === "web_push" || telegramEnabled;

  return (
    <Card className="w-full max-w-lg bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
      <CardHeader>
        <CardTitle className="text-foreground">Configurações de Notificação</CardTitle>
        <CardDescription className="text-muted-foreground">
          Gerencie como você recebe notificações do Nexus Flow.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="notification_channel" className="text-foreground">Canal de Notificação Preferido (Web Push)</Label>
            <Select
              onValueChange={(value: "web_push" | "none") =>
                form.setValue("notification_channel", value)
              }
              value={notificationChannel}
            >
              <SelectTrigger id="notification_channel" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
                <SelectValue placeholder="Selecionar canal" />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                <SelectItem value="web_push">Notificação Web Push (Navegador/Celular)</SelectItem>
                <SelectItem value="none">Nenhum</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {notificationChannel === "web_push" && (
            <div className="mt-4">
              <WebPushToggle />
            </div>
          )}

          {isAnyNotificationChannelEnabled && (
            <>
              <div className="mt-6 border-t border-border pt-4">
                <h3 className="text-lg font-semibold text-foreground mb-3">Horários dos Relatórios</h3>
                <div>
                  <Label htmlFor="daily_brief_morning_time" className="text-foreground">Brief Diário (Manhã)</Label>
                  <TimePicker
                    value={form.watch("daily_brief_morning_time")}
                    onChange={(time) => form.setValue("daily_brief_morning_time", time || "08:00")}
                  />
                </div>
                <div className="mt-3">
                  <Label htmlFor="daily_brief_evening_time" className="text-foreground">Brief Diário (Noite)</Label>
                  <TimePicker
                    value={form.watch("daily_brief_evening_time")}
                    onChange={(time) => form.setValue("daily_brief_evening_time", time || "18:00")}
                  />
                </div>
                <div className="mt-3">
                  <Label htmlFor="weekly_brief_day" className="text-foreground">Dia do Resumo Semanal</Label>
                  <Select
                    onValueChange={(value: string) => form.setValue("weekly_brief_day", value)}
                    value={form.watch("weekly_brief_day")}
                  >
                    <SelectTrigger id="weekly_brief_day" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
                      <SelectValue placeholder="Selecionar dia" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                      {DAYS_OF_WEEK_OPTIONS.map(day => (
                        <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-3">
                  <Label htmlFor="weekly_brief_time" className="text-foreground">Horário do Resumo Semanal</Label>
                  <TimePicker
                    value={form.watch("weekly_brief_time")}
                    onChange={(time) => form.setValue("weekly_brief_time", time || "08:00")}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <Button
                  type="button"
                  onClick={handleSendTestNotification}
                  disabled={isSendingTest}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  <BellRing className="mr-2 h-4 w-4" />
                  {isSendingTest ? "Enviando Teste..." : "Enviar Notificação de Teste"}
                </Button>
                <Button
                  type="button"
                  onClick={handleSendDailyBriefTest}
                  disabled={isSendingDailyBriefTest}
                  className="w-full bg-green-600 text-white hover:bg-green-700"
                >
                  <Sun className="mr-2 h-4 w-4" />
                  {isSendingDailyBriefTest ? "Enviando Brief..." : "Enviar Brief da Manhã (Teste)"}
                </Button>
                <Button
                  type="button"
                  onClick={handleSendWeeklyBriefTest}
                  disabled={isSendingWeeklyBriefTest}
                  className="w-full bg-purple-600 text-white hover:bg-purple-700"
                >
                  <CalendarCheck className="mr-2 h-4 w-4" />
                  {isSendingWeeklyBriefTest ? "Enviando Resumo Semanal..." : "Enviar Resumo Semanal (Teste)"}
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSettingsCard;