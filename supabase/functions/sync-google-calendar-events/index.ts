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
      .select('google_access_token, google_refresh_token, google_token_expiry, google_calendar_id')
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

    if (!accessToken || !refreshToken || !calendarId) {
      return new Response(
        JSON.stringify({ message: "Google Calendar integration not fully configured (missing tokens or calendar ID)." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
        // Considerar desativar a integração ou notificar o usuário
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

    // 3. Buscar eventos do Google Calendar
    const timeMin = formatISO(addMinutes(now, -60 * 24 * 30)); // Eventos dos últimos 30 dias
    const timeMax = formatISO(addMinutes(now, 60 * 24 * 30)); // Eventos dos próximos 30 dias

    const calendarEventsResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!calendarEventsResponse.ok) {
      const errorData = await calendarEventsResponse.json();
      console.error("Erro ao buscar eventos do Google Calendar:", errorData);
      return new Response(
        JSON.stringify({ error: "Failed to fetch Google Calendar events.", details: errorData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { items: googleEvents } = await calendarEventsResponse.json();

    // 4. Sincronizar eventos com a tabela `events` do Supabase
    const eventsToInsert = [];
    const eventsToUpdate = [];
    const existingGoogleEventIds = new Set<string>();

    // Buscar todos os eventos existentes para este usuário e calendário
    const { data: existingEvents, error: fetchExistingError } = await supabase
      .from('events')
      .select('google_event_id')
      .eq('user_id', userId)
      .eq('calendar_id', calendarId);

    if (fetchExistingError) throw fetchExistingError;
    existingEvents?.forEach(e => existingGoogleEventIds.add(e.google_event_id));

    for (const event of googleEvents) {
      if (!event.start || !event.end || !event.id) continue; // Ignorar eventos sem data/hora ou ID

      const eventData = {
        user_id: userId,
        google_event_id: event.id,
        calendar_id: calendarId,
        title: event.summary || "No Title",
        description: event.description || null,
        start_time: event.start.dateTime || event.start.date, // dateTime for timed, date for all-day
        end_time: event.end.dateTime || event.end.date,
        location: event.location || null,
        html_link: event.htmlLink || null,
        updated_at: new Date().toISOString(),
      };

      if (existingGoogleEventIds.has(event.id)) {
        eventsToUpdate.push(eventData);
      } else {
        eventsToInsert.push(eventData);
      }
    }

    if (eventsToInsert.length > 0) {
      const { error: insertError } = await supabase.from('events').insert(eventsToInsert);
      if (insertError) console.error("Erro ao inserir eventos:", insertError);
      else console.log(`Inseridos ${eventsToInsert.length} novos eventos.`);
    }

    // Supabase não suporta upsert em lote diretamente para colunas não-PK com `onConflict`
    // Para atualizações, faremos uma por uma ou uma query mais complexa se o volume for muito alto.
    // Por simplicidade, vamos iterar para atualizar.
    for (const eventData of eventsToUpdate) {
      const { error: updateError } = await supabase
        .from('events')
        .update(eventData)
        .eq('user_id', userId)
        .eq('google_event_id', eventData.google_event_id);
      if (updateError) console.error(`Erro ao atualizar evento ${eventData.google_event_id}:`, updateError);
    }
    if (eventsToUpdate.length > 0) console.log(`Atualizados ${eventsToUpdate.length} eventos existentes.`);

    return new Response(JSON.stringify({ message: "Google Calendar events synced successfully." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function sync-google-calendar-events:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});