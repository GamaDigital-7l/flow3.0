"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link as LinkIcon, Unlink, Loader2 } from "lucide-react";
import { supabase, supabaseUrl } from "@/integrations/supabase/client"; // Importar supabaseUrl
import { showError, showSuccess } from "@/utils/toast";
import { useSearchParams } from "react-router-dom";
import { Session } from "@supabase/supabase-js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { ptBR } from "date-fns/locale";

interface IntegrationsCardProps {
  userId: string | undefined;
  session: Session | null;
  isGoogleConnected: boolean;
  setIsGoogleConnected: React.Dispatch<React.SetStateAction<boolean>>;
  isConnectingGoogle: boolean;
  setIsConnectingGoogle: React.Dispatch<React.SetStateAction<boolean>>;
  onGoogleAuthComplete: () => void;
}

interface GoogleCalendar {
  id: string;
  summary: string;
  primary: boolean;
}

const fetchGoogleCalendars = async (accessToken: string): Promise<GoogleCalendar[]> => {
  const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    // console.error("Erro ao buscar calendários do Google:", errorData); // Removido console.error
    throw new Error("Falha ao buscar calendários do Google.");
  }

  const data = await response.json();
  return data.items || [];
};

const IntegrationsCard: React.FC<IntegrationsCardProps> = ({
  userId,
  session,
  isGoogleConnected,
  setIsGoogleConnected,
  isConnectingGoogle,
  setIsConnectingGoogle,
  onGoogleAuthComplete,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCalendarId, setSelectedCalendarId] = React.useState<string | null>(null);
  const [isSavingCalendar, setIsSavingCalendar] = React.useState(false);

  const { data: googleCalendars, isLoading: isLoadingCalendars, error: calendarsError, refetch: refetchCalendars } = useQuery<GoogleCalendar[], Error>({
    queryKey: ["googleCalendars", session?.access_token],
    queryFn: () => fetchGoogleCalendars(session!.access_token!),
    enabled: isGoogleConnected && !!session?.access_token,
  });

  React.useEffect(() => {
    const googleAuthSuccess = searchParams.get("google_auth_success");
    if (googleAuthSuccess === "true") {
      showSuccess("Google Calendar conectado com sucesso!");
      setSearchParams({}, { replace: true });
      onGoogleAuthComplete(); // Isso irá refetchar o perfil e o status de conexão
    } else if (searchParams.get("google_auth_error")) {
      showError("Erro ao conectar Google Calendar. Tente novamente.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, onGoogleAuthComplete]);

  // Carregar o calendar_id salvo no perfil quando o componente é montado ou o perfil é atualizado
  React.useEffect(() => {
    const loadSavedCalendarId = async () => {
      if (userId && isGoogleConnected) {
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("google_calendar_id")
          .eq("id", userId)
          .single();
        if (error && error.code !== 'PGRST116') {
          // console.error("Erro ao carregar google_calendar_id:", error); // Removido console.error
        } else if (profileData) {
          setSelectedCalendarId(profileData.google_calendar_id);
        }
      }
    };
    loadSavedCalendarId();
  }, [userId, isGoogleConnected]);

  const handleConnectGoogleCalendar = () => {
    if (!userId) {
      showError("Usuário não autenticado. Faça login para conectar o Google Calendar.");
      return;
    }
    setIsConnectingGoogle(true);
    // Usar supabaseUrl importado para construir o URL da Edge Function
    const googleOAuthInitUrl = `${supabaseUrl}/functions/v1/google-oauth/init`;
    window.location.href = googleOAuthInitUrl;
  };

  const handleDisconnectGoogleCalendar = async () => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (!window.confirm("Tem certeza que deseja desconectar o Google Calendar? Isso removerá todos os eventos sincronizados.")) {
      return;
    }

    try {
      // Remover eventos sincronizados
      const { error: deleteEventsError } = await supabase
        .from("events")
        .delete()
        .eq("user_id", userId);
      if (deleteEventsError) console.error("Erro ao deletar eventos sincronizados:", deleteEventsError);

      // Remover tokens e calendar_id do perfil
      const { error } = await supabase
        .from("profiles")
        .update({
          google_access_token: null,
          google_refresh_token: null,
          google_token_expiry: null,
          google_calendar_id: null,
        })
        .eq("id", userId);

      if (error) throw error;
      showSuccess("Google Calendar desconectado com sucesso!");
      setIsGoogleConnected(false);
      setSelectedCalendarId(null);
    } catch (err: any) {
      showError("Erro ao desconectar Google Calendar: " + err.message);
      // console.error("Erro ao desconectar Google Calendar:", err); // Removido console.error
    }
  };

  const handleSaveCalendarSelection = async () => {
    if (!userId || !selectedCalendarId) {
      showError("Por favor, selecione um calendário.");
      return;
    }
    setIsSavingCalendar(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ google_calendar_id: selectedCalendarId, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;
      showSuccess("Calendário do Google selecionado com sucesso!");
      // Invocar a função de sincronização imediatamente após salvar a seleção
      await supabase.functions.invoke('sync-google-calendar-events', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });
      showSuccess("Eventos do Google Calendar sincronizados!");
    } catch (err: any) {
      showError("Erro ao salvar seleção do calendário ou sincronizar eventos: " + err.message);
      // console.error("Erro ao salvar seleção do calendário ou sincronizar eventos:", err); // Removido console.error
    } finally {
      setIsSavingCalendar(false);
    }
  };

  return (
    <Card className="w-full max-w-lg bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
      <CardHeader>
        <CardTitle className="text-foreground">Integrações</CardTitle>
        <CardDescription className="text-muted-foreground">
          Conecte serviços externos para expandir as funcionalidades do Nexus Flow.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="border-b border-border pb-4">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Google Calendar</h3>
            {isGoogleConnected ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="google-calendar-select" className="text-foreground">Selecionar Calendário para Sincronizar</Label>
                  <Select
                    onValueChange={setSelectedCalendarId}
                    value={selectedCalendarId || ""}
                    disabled={isLoadingCalendars || isSavingCalendar}
                  >
                    <SelectTrigger id="google-calendar-select" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
                      {isLoadingCalendars ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" /> Carregando calendários...
                        </div>
                      ) : (
                        <SelectValue placeholder="Selecione um calendário" />
                      )}
                    </SelectTrigger>
                    <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                      {googleCalendars?.map((calendar) => (
                        <SelectItem key={calendar.id} value={calendar.id}>
                          {calendar.summary} {calendar.primary && "(Principal)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {calendarsError && (
                    <p className="text-red-500 text-sm mt-1">Erro ao carregar calendários: {calendarsError.message}</p>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={handleSaveCalendarSelection}
                  disabled={!selectedCalendarId || isSavingCalendar}
                  className="w-full bg-blue-500 text-white hover:bg-blue-600"
                >
                  {isSavingCalendar ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LinkIcon className="mr-2 h-4 w-4" />
                  )}
                  {isSavingCalendar ? "Salvar Calendário e Sincronizar..." : "Salvar Calendário e Sincronizar"}
                </Button>
                <Button
                  type="button"
                  onClick={handleDisconnectGoogleCalendar}
                  variant="destructive"
                  className="w-full"
                >
                  <Unlink className="mr-2 h-4 w-4" />
                  Desconectar Google Calendar
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                onClick={handleConnectGoogleCalendar}
                disabled={isConnectingGoogle}
                className="w-full bg-blue-500 text-white hover:bg-blue-600"
              >
                <LinkIcon className="mr-2 h-4 w-4" />
                {isConnectingGoogle ? "Conectando..." : "Conectar Google Calendar"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default IntegrationsCard;