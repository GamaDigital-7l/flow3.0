import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.2";
import { format, isSameMinute, parseISO, setHours, setMinutes, isBefore, startOfDay } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime, zonedTimeToUtc } from "https://esm.sh/date-fns-tz@2.0.1";

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

    const { taskId, userId: bodyUserId } = await req.json(); // Obter userId do corpo

    if (!bodyUserId || !taskId) {
      return new Response(
        JSON.stringify({ error: "Missing userId or taskId." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userId = bodyUserId;

    // Obter o fuso horário do usuário e configurações de notificação
    const { data: settings, error: settingsError } = await supabaseServiceRole
      .from("settings")
      .select("webpush_enabled, telegram_enabled, telegram_bot_token, telegram_chat_id, profiles(timezone)")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error(`[User ${userId}] Erro ao buscar configurações do usuário:`, settingsError);
      throw settingsError;
    }

    let webpushEnabled = settings?.webpush_enabled || false;
    let telegramEnabled = settings?.telegram_enabled || false;
    const telegramBotToken = settings?.telegram_bot_token;
    const telegramChatId = settings?.telegram_chat_id;
    const userTimezone = settings?.profiles?.timezone || "America/Sao_Paulo";

    // Configuração do web-push (apenas se habilitado e chaves presentes)
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");

    if (webpushEnabled) { // Only set VAPID details if webpush is enabled
      if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
        console.error("VAPID keys not configured in Supabase secrets for Web Push notifications.");
        webpushEnabled = false; // Disable webpush para este usuário se as chaves estiverem faltando
      } else {
        webpush.setVapidDetails(
          'mailto: <gustavogama099@gmail.com>',
          VAPID_PUBLIC_KEY!,
          VAPID_PRIVATE_KEY!
        );
      }
    }

    // Buscar a tarefa específica
    const { data: task, error: fetchTaskError } = await supabaseServiceRole
      .from('tasks')
      .select('id, title, recurrence_time')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single();

    if (fetchTaskError) {
      console.error(`[User ${userId}] Erro ao buscar tarefa ${taskId}:`, fetchTaskError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch task." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!task || !task.recurrence_time) {
      return new Response(
        JSON.stringify({ message: "Task not found or no recurrence time set." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const notificationTitle = `Lembrete de Tarefa Recorrente: ${task.title}`;
    const notificationBody = `Sua tarefa "${task.title}" está agendada para agora. Clique para concluir!`;
    const notificationUrl = `/tasks?complete_task_id=${task.id}`; // URL com parâmetro para ação rápida

    const payload = {
      title: notificationTitle,
      body: notificationBody,
      url: notificationUrl,
      actions: [
        {
          action: `complete-task-${task.id}`,
          title: "Concluir Tarefa",
        },
      ],
    };

    // Enviar notificação Web Push
    if (webpushEnabled) {
      const { data: subscriptions, error: fetchSubsError } = await supabaseServiceRole
        .from('user_subscriptions')
        .select('subscription')
        .eq('user_id', userId);

      if (fetchSubsError) {
        console.error(`[User ${userId}] Erro ao buscar inscrições de usuário:`, fetchSubsError);
        // Não lançar erro fatal, apenas continuar sem web push
      } else if (subscriptions && subscriptions.length > 0) {
        const notificationPromises = subscriptions.map(async (subRecord) => {
          try {
            await webpush.sendNotification(
              subRecord.subscription as webpush.PushSubscription,
              JSON.stringify(payload)
            );
            console.log(`[User ${userId}] Notificação push enviada para a tarefa ${task.id}.`);
          } catch (pushError: any) {
            console.error(`Erro ao enviar notificação push para a tarefa ${task.id}:`, pushError);
            if (pushError.statusCode === 410 || pushError.statusCode === 404) {
              console.warn(`[User ${userId}] Inscrição de push inválida/expirada. Removendo...`);
              await supabaseServiceRole.from('user_subscriptions').delete().eq('subscription', subRecord.subscription);
            }
          }
        });
        await Promise.all(notificationPromises);
      } else {
        console.log(`[User ${userId}] Nenhuma inscrição de web push encontrada.`);
      }
    } else {
      console.log(`[User ${userId}] Notificações Web Push desabilitadas ou chaves VAPID ausentes.`);
    }

    // Enviar notificação Telegram
    if (telegramEnabled && telegramBotToken && telegramChatId) {
      try {
        const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: `${notificationTitle}\n${notificationBody}`,
            parse_mode: 'Markdown',
          }),
        });

        if (!telegramResponse.ok) {
          const errorData = await telegramResponse.json();
          console.error("Erro ao enviar mensagem para o Telegram:", errorData);
        } else {
          console.log(`[User ${userId}] Mensagem Telegram enviada para a tarefa ${task.id}.`);
        }
      } catch (telegramError: any) {
        console.error(`Erro ao enviar mensagem Telegram para ${userId}:`, telegramError);
      }
    }

    return new Response(JSON.stringify({ message: "Recurring task notification sent." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function send-recurring-task-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});