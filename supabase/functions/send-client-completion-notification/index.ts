import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.2";
import { format } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@2.0.1";
import { ptBR } from "https://esm.sh/date-fns@3.6.0/locale/pt-BR";

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
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userAuth, error: authError } = await supabaseServiceRole.auth.getUser(token);

    if (authError || !userAuth.user) {
      console.error("Erro de autenticação:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or missing token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userId = userAuth.user.id;

    const { clientId, monthYearRef, completedCount, totalCount, clientName } = await req.json();

    if (!clientId || !monthYearRef || completedCount === undefined || totalCount === undefined || !clientName) {
      return new Response(
        JSON.stringify({ error: "Missing required payload fields." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: settings, error: settingsError } = await supabaseServiceRole
      .from("settings")
      .select("telegram_bot_token, telegram_chat_id, telegram_enabled, webpush_enabled, profiles(timezone)")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error("Erro ao buscar configurações:", settingsError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let telegramEnabled = settings?.telegram_enabled || false;
    let webpushEnabled = settings?.webpush_enabled || false;
    const telegramBotToken = settings?.telegram_bot_token;
    const telegramChatId = settings?.telegram_chat_id;
    const userTimezone = settings?.profiles?.timezone || "America/Sao_Paulo";

    if (!telegramEnabled && !webpushEnabled) {
      return new Response(
        JSON.stringify({ message: "Nenhum canal de notificação habilitado para este usuário." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Configuração do web-push
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");

    if (webpushEnabled && (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY)) {
      console.error("VAPID keys not configured in Supabase secrets for Web Push notifications.");
      webpushEnabled = false; // Desabilitar webpush se as chaves não estiverem configuradas
    }
    if (webpushEnabled) {
      webpush.setVapidDetails(
        'mailto: <gustavogama099@gmail.com>',
        VAPID_PUBLIC_KEY!,
        VAPID_PRIVATE_KEY!
      );
    }

    const monthName = format(new Date(`${monthYearRef}-01`), "MMMM yyyy", { locale: ptBR });
    const notificationTitle = `🎉 Meta Batida para ${clientName}!`;
    const briefMessage = `Parabéns! Você concluiu ${completedCount}/${totalCount} tarefas para ${clientName} em ${monthName}.`;
    const notificationUrl = `/clients/${clientId}`;

    // Enviar notificação Web Push
    if (webpushEnabled) {
      const { data: subscriptions, error: fetchError } = await supabaseServiceRole
        .from('user_subscriptions')
        .select('subscription')
        .eq('user_id', userId);

      if (fetchError) {
        console.error("Erro ao buscar inscrições de usuário para web push:", fetchError);
      } else if (subscriptions && subscriptions.length > 0) {
        const pushPromises = subscriptions.map(async (subRecord) => {
          try {
            await webpush.sendNotification(
              subRecord.subscription as webpush.PushSubscription,
              JSON.stringify({
                title: notificationTitle,
                body: briefMessage,
                url: notificationUrl,
              })
            );
            console.log(`Notificação web push enviada para o usuário ${userId} sobre ${clientName}.`);
          } catch (pushError: any) {
            console.error(`Erro ao enviar notificação web push para ${userId} (cliente ${clientName}):`, pushError);
            if (pushError.statusCode === 410 || pushError.statusCode === 404) {
              console.warn(`Inscrição de web push inválida/expirada para o usuário ${userId}. Removendo...`);
              await supabaseServiceRole.from('user_subscriptions').delete().eq('subscription', subRecord.subscription);
            }
          }
        });
        await Promise.all(pushPromises);
      } else {
        console.log(`[User ${userId}] Nenhuma inscrição de web push encontrada para ${clientName}.`);
      }
    }

    // Enviar notificação Telegram
    if (telegramEnabled && telegramBotToken && telegramChatId) {
      try {
        const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: briefMessage,
            parse_mode: 'Markdown',
          }),
        });

        if (!telegramResponse.ok) {
          const errorData = await telegramResponse.json();
          console.error("Erro ao enviar mensagem para o Telegram:", errorData);
          throw new Error(errorData.description || "Erro desconhecido ao enviar para o Telegram.");
        }
        console.log(`Mensagem Telegram enviada para o usuário ${userId} sobre ${clientName}.`);
      } catch (telegramError: any) {
        console.error(`Erro ao enviar mensagem Telegram para ${userId} (cliente ${clientName}):`, telegramError);
      }
    }

    return new Response(JSON.stringify({ message: "Notificação de conclusão de cliente processada com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na Edge Function send-client-completion-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});