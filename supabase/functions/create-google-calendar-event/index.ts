import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { addMinutes, formatISO } from "https://esm.sh/date-fns@3.6.0";

const allowedOrigins = ['http://localhost:32100', 'https://nexusflow.vercel.app'];

serve(async (req) => {
  const origin = req.headers.get("origin");
  const isAllowedOrigin = allowedOrigins.includes(origin!);

  const corsHeaders = {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin! : '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userAuth, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userAuth.user) {
      console.error("Erro de autenticação:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or missing token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userId = userAuth.user.id;

    // 1. Obter tokens do Google e calendar_id do perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('google_access_token, google_refresh_token, google_token_expiry, google_calendar_id, timezone')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error("Erro ao buscar perfil do usuário ou perfil não encontrado:", profileError);
      return new Response(
        JSON.stringify({ error: "User profile not found or Google integration not set up." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let accessToken = profile.google_access_token;
    const refreshToken = profile.google_refresh_token;
    const tokenExpiry = profile.google_token_expiry;
    const calendarId = profile.google_calendar_id;
    const userTimezone = profile.timezone || 'America/Sao_Paulo';

    if (!accessToken || !refreshToken || !calendarId) {
      return new Response(
        JSON.stringify({ error: "Google Calendar integration not fully configured (missing tokens or calendar ID)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Verificar e refrescar o token de acesso se necessário
    const now = new Date();
    const expiryDate = new Date(tokenExpiry);

    if (now >= expiryDate) {
      console.log("Token de acesso expirado, tentando refrescar...");
      const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
      const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return new Response(
          JSON.stringify({ error: "Google OAuth environment variables are not set for token refresh." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }).toString(),
      });

      if (!refreshResponse.ok) {
        const errorData = await refreshResponse.json();
        console.error("Erro ao refrescar token:", errorData);
        return new Response(
          JSON.stringify({ error: "Failed to refresh Google access token.", details: errorData }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const refreshedTokens = await refreshResponse.json();
      accessToken = refreshedTokens.access_token;
      const newExpiresIn = refreshedTokens.expires_in;
      const newExpiryDate = addMinutes(now, newExpiresIn / 60); // expires_in is in seconds

      // Atualizar o perfil do usuário com o novo token de acesso e data de expiração
      const { error: updateTokenError } = await supabase
        .from('profiles')
        .update({
          google_access_token: accessToken,
          google_token_expiry: newExpiryDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateTokenError) {
        console.error("Erro ao salvar token refrescado:", updateTokenError);
        throw updateTokenError;
      }
      console.log("Token de acesso refrescado e salvo com sucesso.");
    }

    // 3. Receber os dados do evento do corpo da requisição
    const { title, description, date, startTime, endTime, location } = await req.json();

    if (!title || !date || !startTime) {
      return new Response(
        JSON.stringify({ error: "Missing required event fields: title, date, or startTime." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Formatar datas e horas para o formato da API do Google Calendar
    const startDateTime = `${date}T${startTime}:00`;
    const endDateTime = endTime ? `${date}T${endTime}:00` : null;

    const event = {
      summary: title,
      description: description || null,
      location: location || null,
      start: {
        dateTime: startDateTime,
        timeZone: userTimezone, // Usar fuso horário do perfil
      },
      end: {
        dateTime: endDateTime || startDateTime, // Se não houver end_time, usar start_time
        timeZone: userTimezone,
      },
    };

    // 4. Criar o evento no Google Calendar
    const googleCalendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!googleCalendarResponse.ok) {
      const errorData = await googleCalendarResponse.json();
      console.error("Erro ao criar evento no Google Calendar:", errorData);
      return new Response(
        JSON.stringify({ error: "Failed to create Google Calendar event.", details: errorData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const createdEvent = await googleCalendarResponse.json();

    return new Response(JSON.stringify({ googleEventId: createdEvent.id, htmlLink: createdEvent.htmlLink }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function create-google-calendar-event:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});