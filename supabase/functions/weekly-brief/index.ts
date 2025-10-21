import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, subWeeks, isToday, isThisWeek, isThisMonth, parseISO, getDay, isBefore, startOfDay, isSameDay, isSameMinute } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime, formatInTimeZone } from "https://esm.sh/date-fns-tz@2.0.1";
import OpenAI from "https://esm.sh/openai@4.52.2";
import Groq from "https://esm.sh/groq-sdk@0.10.0";
import webpush from "https://esm.sh/web-push@3.6.2";

const allowedOrigins = ['http://localhost:32100', 'https://nexusflow.vercel.app'];
const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo'; // Define a constant for the fallback timezone

// Helper function to get adjusted completion status for recurring tasks
const getAdjustedTaskCompletionStatus = (task: any, nowInUserTimezone: Date): boolean => {
  if (task.recurrence_type === "none") {
    return task.is_completed;
  }

  if (!task.last_successful_completion_date) {
    return false; // Never completed in this cycle
  }

  const lastCompletionDate = parseISO(task.last_successful_completion_date);
  
  switch (task.recurrence_type) {
    case "daily":
      return isSameDay(lastCompletionDate, nowInUserTimezone);
    case "weekly":
      // Usando weekStartsOn: 0 (Domingo) para consistência com os padrões do date-fns
      return isThisWeek(lastCompletionDate, { weekStartsOn: 0 });
    case "monthly":
      return isThisMonth(lastCompletionDate);
    default:
      return task.is_completed;
  }
};

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

    let userId: string;
    const { type, userId: bodyUserId } = await req.json(); // Obter userId do corpo se for chamada de serviço

    if (bodyUserId) {
      userId = bodyUserId;
    } else {
      // Se não houver userId no corpo, tentar autenticar via cabeçalho (chamada do frontend)
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
      userId = userAuth.user.id;
    }

    const { data: profile, error: profileError } = await supabaseServiceRole
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error("Erro ao buscar perfil do usuário:", profileError);
      throw profileError;
    }
    const userTimezone = profile?.timezone || SAO_PAULO_TIMEZONE;

    const { data: settings, error: settingsError } = await supabaseServiceRole
      .from("settings")
      .select("groq_api_key, openai_api_key, ai_provider_preference, telegram_bot_token, telegram_chat_id, telegram_enabled, webpush_enabled, weekly_brief_day, weekly_brief_time")
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
    const AI_PROVIDER = settings?.ai_provider_preference || 'groq';

    if (!telegramEnabled && !webpushEnabled && type !== 'test_notification') {
      return new Response(
        JSON.stringify({ message: "Nenhum canal de notificação habilitado. Nenhuma notificação enviada." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Configuração do web-push
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");

    if (webpushEnabled) { // Only set VAPID details if webpush is enabled
      if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
        console.error("VAPID keys not configured in Supabase secrets for Web Push notifications.");
        webpushEnabled = false; // Disable webpush for this user if keys are missing
      } else {
        webpush.setVapidDetails(
          'mailto: <gustavogama099@gmail.com>',
          VAPID_PUBLIC_KEY!,
          VAPID_PRIVATE_KEY!
        );
      }
    }

    const nowUtc = new Date();
    const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
    const oneWeekAgo = subWeeks(nowInUserTimezone, 1);
    const twoWeeksAgo = subWeeks(nowInUserTimezone, 2);

    let briefMessage = "";
    let notificationTitle = "";
    let notificationUrl = "/dashboard";

    if (type === 'test_notification') {
      notificationTitle = "Notificação de Teste Semanal";
      briefMessage = "Esta é uma notificação de teste semanal enviada com sucesso!";
    } else if (type === 'weekly_brief') {
      const { data: lastWeekTasks, error: lastWeekError } = await supabaseServiceRole
        .from("tasks")
        .select("is_completed, created_at")
        .eq("user_id", userId)
        .gte("created_at", format(oneWeekAgo, "yyyy-MM-dd"))
        .lt("created_at", format(nowInUserTimezone, "yyyy-MM-dd"));

      if (lastWeekError) throw lastWeekError;

      const { data: previousWeekTasks, error: previousWeekError } = await supabaseServiceRole
        .from("tasks")
        .select("is_completed, created_at")
        .eq("user_id", userId)
        .gte("created_at", format(twoWeeksAgo, "yyyy-MM-dd"))
        .lt("created_at", format(oneWeekAgo, "yyyy-MM-dd"));

      if (previousWeekError) throw previousWeekError;

      const lastWeekCompleted = lastWeekTasks?.filter(t => t.is_completed).length || 0;
      const previousWeekCompleted = previousWeekTasks?.filter(t => t.is_completed).length || 0;

      const productivityChange = previousWeekCompleted > 0
        ? ((lastWeekCompleted - previousWeekCompleted) / previousWeekCompleted) * 100
        : (lastWeekCompleted > 0 ? 100 : 0);

      let aiClient;
      let modelName;

      if (AI_PROVIDER === 'groq') {
        const groqApiKey = settings?.groq_api_key || Deno.env.get("GROQ_API_KEY");
        if (!groqApiKey) {
          return new Response(
            JSON.stringify({ error: "Groq API Key not configured for weekly brief." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        aiClient = new Groq({ apiKey: groqApiKey });
        modelName = "llama3-8b-8192";
      } else if (AI_PROVIDER === 'openai') {
        const openaiApiKey = settings?.openai_api_key || Deno.env.get("OPENAI_API_KEY");
        if (!openaiApiKey) {
          return new Response(
            JSON.stringify({ error: "OpenAI API Key not configured for weekly brief." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        aiClient = new OpenAI({ apiKey: openaiApiKey });
        modelName = "gpt-3.5-turbo";
      } else {
        return new Response(
          JSON.stringify({ error: "Provedor de IA não suportado para brief semanal." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const prompt = `
        Você é o Nexus Flow, um assistente de produtividade. Gere uma análise de produtividade semanal comparativa.
        Dados da última semana:
        - Tarefas concluídas: ${lastWeekCompleted}
        - Tarefas criadas: ${lastWeekTasks?.length || 0}

        Dados da semana anterior:
        - Tarefas concluídas: ${previousWeekCompleted}
        - Tarefas criadas: ${previousWeekTasks?.length || 0}

        Instruções:
        1. Comece com uma saudação e apresente o resumo da semana.
        2. Compare a produtividade (tarefas concluídas) entre as duas semanas. Apresente a variação percentual no formato: "Sua produtividade ${productivityChange >= 0 ? 'aumentou' : 'diminuiu'} ${Math.abs(productivityChange.toFixed(0))}% em relação à semana passada."
        3. Analise a constância (tarefas criadas vs. concluídas).
        4. Dê um alerta ou um elogio com base na comparação.
        5. Termine com uma sugestão para a próxima semana.
        6. Use markdown. Seja conciso e analítico.
      `;

      const chatCompletion = await aiClient.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: modelName,
        temperature: 0.7,
        max_tokens: 500,
      });

      briefMessage = chatCompletion.choices[0].message.content || "Não foi possível gerar o resumo semanal.";
      notificationTitle = "Seu Resumo Semanal com IA";
    } else {
      return new Response(
        JSON.stringify({ error: "Tipo de notificação semanal inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Enviar notificação Web Push
    if (webpushEnabled) {
      const { data: subscriptions, error: fetchError } = await supabaseServiceRole
        .from('user_subscriptions')
        .select('subscription')
        .eq('user_id', userId);

      if (fetchError) {
        console.error("Erro ao buscar inscrições de usuário para web push:", fetchError);
        // Não lançar erro fatal, apenas continuar sem web push
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
            console.log(`Notificação web push enviada para o usuário ${userId}.`);
          } catch (pushError: any) {
            console.error(`Erro ao enviar notificação web push para ${userId}:`, pushError);
            if (pushError.statusCode === 410 || pushError.statusCode === 404) {
              console.warn(`Inscrição de web push inválida/expirada para o usuário ${userId}. Removendo...`);
              await supabaseServiceRole.from('user_subscriptions').delete().eq('subscription', subRecord.subscription);
            }
          }
        });
        await Promise.all(pushPromises);
      } else {
        console.log(`[User ${userId}] Nenhuma inscrição de web push encontrada.`);
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
            parse_mode: 'Markdown', // Ou 'HTML' se preferir
          }),
        });

        if (!telegramResponse.ok) {
          const errorData = await telegramResponse.json();
          console.error("Erro ao enviar mensagem para o Telegram:", errorData);
          throw new Error(errorData.description || "Erro desconhecido ao enviar para o Telegram.");
        }
        console.log(`Mensagem Telegram enviada para o usuário ${userId}.`);
      } catch (telegramError: any) {
        console.error(`Erro ao enviar mensagem Telegram para ${userId}:`, telegramError);
      }
    }

    return new Response(JSON.stringify({ message: "Resumo semanal/notificação de teste processado com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na Edge Function weekly-brief:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});