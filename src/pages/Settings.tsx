"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import ProfileManagementCard from "@/components/settings/ProfileManagementCard";
import IntegrationsCard from "@/components/settings/IntegrationsCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ptBR } from "date-fns/locale";

// Lista de fusos horários comuns (pode ser expandida)
const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo (GMT-3)" },
  { value: "America/New_York", label: "America/New_York (GMT-4)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (GMT-7)" },
  { value: "Europe/London", label: "Europe/London (GMT+1)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (GMT+2)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (GMT+9)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (GMT+10)" },
  // Adicione mais fusos horários conforme necessário
];

// Schema vazio, pois as configurações de AI/Notificação foram removidas.
const settingsSchema = z.object({});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

const Settings: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isUpdatingProfileEmail, setIsUpdatingProfileEmail] = useState(false);
  const [userTimezone, setUserTimezone] = useState<string | null>(null); // Estado para o fuso horário

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {},
  });

  const fetchSettingsAndGoogleStatus = useCallback(async () => {
    if (!userId) return;

    // Fetch user settings (only to get settingsId if needed for future updates)
    const { data: settingsData, error: settingsError } = await supabase
      .from("settings")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      showError("Erro ao carregar configurações: " + settingsError.message);
    } else if (settingsData) {
      setSettingsId(settingsData.id);
    }

    // Fetch user profile to check Google connection status, email, and timezone
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("google_access_token, email, timezone")
      .eq("id", userId) // Ensure we query by the user's auth ID
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // console.error("Erro ao verificar status do Google Calendar ou e-mail do perfil:", profileError);
    } else if (profileData) {
      setIsGoogleConnected(!!profileData.google_access_token);
      setUserTimezone(profileData.timezone);
    } else {
      setIsGoogleConnected(false);
      setUserTimezone(null);
    }
  }, [userId]);

  useEffect(() => {
    fetchSettingsAndGoogleStatus();
  }, [fetchSettingsAndGoogleStatus]);

  const onSubmit = async () => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      // Apenas atualiza o fuso horário no perfil
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ timezone: userTimezone, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (profileUpdateError) throw profileUpdateError;
      showSuccess("Configurações salvas com sucesso!");

    } catch (error: any) {
      showError("Erro ao salvar configurações: " + error.message);
      console.error("Erro ao salvar configurações:", error);
    }
  };

  const handleTimezoneChange = (newTimezone: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    setUserTimezone(newTimezone);
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
        onProfileEmailSynced={fetchSettingsAndGoogleStatus} // Re-fetch all settings and status after email sync
      />

      <Card className="w-full max-w-lg bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-foreground">Fuso Horário</CardTitle>
          <CardDescription className="text-muted-foreground">
            Selecione seu fuso horário para agendamentos precisos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="timezone" className="text-foreground">Seu Fuso Horário</Label>
              <Select
                onValueChange={handleTimezoneChange}
                value={userTimezone || ""}
              >
                <SelectTrigger id="timezone" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
                  <SelectValue placeholder="Selecionar fuso horário" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <IntegrationsCard
        userId={userId}
        session={session}
        isGoogleConnected={isGoogleConnected}
        setIsGoogleConnected={setIsGoogleConnected}
        isConnectingGoogle={isConnectingGoogle}
        setIsConnectingGoogle={setIsConnectingGoogle}
        onGoogleAuthComplete={fetchSettingsAndGoogleStatus} // Re-fetch all settings and status after Google auth
      />

      <Button type="submit" onClick={onSubmit} className="w-full max-w-lg bg-primary text-primary-foreground hover:bg-primary/90 self-center mt-6">
        Salvar Configurações
      </Button>
    </div>
  );
};

export default Settings;