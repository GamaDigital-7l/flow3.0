import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, isToday , getDay, parseISO, isThisWeek, isThisMonth, isBefore, startOfDay, setHours, setMinutes, isSameDay, isSameMinute } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime, formatInTimeZone } from "https://esm.sh/date-fns-tz@2.0.1";
import webpush from "https://esm.sh/web-push@3.6.2";
import OpenAI from "https://esm.sh/openai@4.52.2";
import Groq from "https://esm.sh/groq-sdk@0.10.0";

const allowedOrigins = [
  'http://localhost:32100',
  'http://localhost:8080',
  'https://nexusflow.vercel.app'
];

// Helper function to get adjusted task completion status (copied from frontend)
const getAdjustedTaskCompletionStatus = (task: any, nowInUserTimezone: Date): boolean => {
  if (task.recurrence_type === "none") {
    return task.is_completed;
  }

  if (!task.last_successful_completion_date) {
    return false; // Nunca concluída neste ciclo
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
      return task.is_completed; // Fallback, embora deva ser coberto
  }
};

serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[2],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userId: string;
    const { timeOfDay, userId: bodyUserId } = await req.json(); // Obter userId do corpo se for chamada de serviço

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
    const userTimezone = profile?.timezone || 'America/Sao_Paulo';

    const { data: settings, error: settingsError } = await supabaseServiceRole
      .from("settings")
      .select("groq_api_key, openai_api_key, ai_provider_preference, telegram_bot_token, telegram_chat_id, telegram_enabled, webpush_enabled, daily_brief_morning_time, daily_brief_evening_time")
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

    if (!telegramEnabled && !webpushEnabled && timeOfDay !== 'test_notification') {
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

    // Obter a data e hora atual no fuso horário do usuário
    const nowUtc = new Date();
    const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
    const todayInUserTimezone = format(nowInUserTimezone, "yyyy-MM-dd", { timeZone: userTimezone });
    const currentDayOfWeekInUserTimezone = getDay(nowInUserTimezone); // 0 para domingo, 1 para segunda, etc.

    let briefMessage = "";
    let notificationTitle = "";
    let notificationUrl = "/dashboard";

    if (timeOfDay === 'test_notification') {
      notificationTitle = "Notificação de Teste";
      briefMessage = "Esta é uma notificação de teste enviada com sucesso!";
    } else {
      const { data: tasks, error: tasksError } = await supabaseServiceRole
        .from("tasks")
        .select("id, title, description, due_date, time, recurrence_type, recurrence_details, is_completed, last_successful_completion_date, is_priority, current_board, client_name")
        .eq("user_id", userId)
        .or(`due_date.eq.${todayInUserTimezone},recurrence_type.neq.none`); // Filter by due_date OR recurring

      if (tasksError) {
        console.error("Erro ao buscar tarefas para o brief:", tasksError);
        throw tasksError;
      }

      const isDayIncluded = (details: string | null | undefined, dayIndex: number) => {
        if (!details) return false;
        const days = details.split(',');
        const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
          "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
          "Thursday": 4, "Friday": 5, "Saturday": 6
        };
        return days.some(day => DAYS_OF_WEEK_MAP[day] === dayIndex);
      };

      const relevantTasks = (tasks || []).filter(task => {
        let isTaskDueToday = false;

        if (task.recurrence_type !== "none") {
          if (task.recurrence_type === "daily") {
            isTaskDueToday = true;
          }
          if (task.recurrence_type === "weekly" && task.recurrence_details) {
            if (isDayIncluded(task.recurrence_details, currentDayOfWeekInUserTimezone)) {
              isTaskDueToday = true;
            }
          }
          if (task.recurrence_type === "monthly" && task.recurrence_details) {
            if (parseInt(task.recurrence_details) === nowInUserTimezone.getDate()) {
              isTaskDueToday = true;
            }
          }
        } else if (task.due_date) {
          return format(parseISO(task.due_date), "yyyy-MM-dd") === todayInUserTimezone;
        }
        return isTaskDueToday;
      });

      const pendingTasks = relevantTasks.filter(task => !getAdjustedTaskCompletionStatus(task, nowInUserTimezone));
      const completedTasks = relevantTasks.filter(task => getAdjustedTaskCompletionStatus(task, nowInUserTimezone));
      const overdueTasks = (tasks || []).filter(task => task.current_board === 'overdue');
      const priorityTasks = pendingTasks.filter(task => task.is_priority);
      const clientTasks = pendingTasks.filter(t => t.client_name);
      const personalTasks = pendingTasks.filter(t => !t.client_name);
      const completionPercentage = relevantTasks.length > 0 ? Math.round((completedTasks.length / relevantTasks.length) * 100) : 0;

      let aiClient;
      let modelName;
      const provider = settings?.ai_provider_preference || 'groq';

      if (provider === 'groq') {
        const groqApiKey = settings?.groq_api_key || Deno.env.get("GROQ_API_KEY");
        if (!groqApiKey) throw new Error("Groq API Key not configured.");
        aiClient = new Groq({ apiKey: groqApiKey });
        modelName = "llama3-8b-8192";
      } else {
        const openaiApiKey = settings?.openai_api_key || Deno.env.get("OPENAI_API_KEY");
        if (!openaiApiKey) throw new Error("OpenAI API Key not configured.");
        aiClient = new OpenAI({ apiKey: openaiApiKey });
        modelName = "gpt-3.5-turbo";
      }

      let prompt = "";
      if (timeOfDay === 'morning') {
        notificationTitle = "Seu Brief da Manhã com IA";
        prompt = `
          Você é o Nexus Flow, um assistente de produtividade. Gere um resumo matinal para o usuário.
          Dados de hoje:
          - Total de tarefas para hoje: ${pendingTasks.length}
          - Tarefas de clientes: ${clientTasks.length}
          - Tarefas pessoais/outras: ${personalTasks.length}
          - Tarefas de alta prioridade: ${priorityTasks.length}
          - Tarefas atrasadas: ${overdueTasks.length}
          
          Lista de tarefas de alta prioridade: ${priorityTasks.map(t => t.title).join(', ') || 'Nenhuma'}
          Lista de tarefas atrasadas: ${overdueTasks.map(t => t.title).join(', ') || 'Nenhuma'}

          Instruções:
          1. Comece com uma saudação amigável, como "Bom dia!".
          2. Apresente o resumo numérico de tarefas no formato: "Hoje você tem ${pendingTasks.length} tarefas — ${clientTasks.length} de clientes e ${personalTasks.length} pessoais/outras."
          3. Analise os dados e identifique as 3 tarefas mais críticas para focar (combine atrasadas e de alta prioridade). Explique por que são críticas.
          4. Termine com uma frase de encorajamento.
          5. Use markdown para formatação (negrito, listas). Seja breve e direto ao ponto.
        `;
      } else { // evening brief
        notificationTitle = "Seu Resumo da Noite com IA";
        prompt = `
          Você é o Nexus Flow, um assistente de produtividade. Gere um resumo noturno para o usuário.
          Dados de hoje:
          - Total de tarefas para o dia: ${relevantTasks.length}
          - Tarefas concluídas hoje: ${completedTasks.length}
          - Tarefas ainda pendentes para hoje: ${pendingTasks.length}
          - Tarefas atrasadas: ${overdueTasks.length}

          Instruções:
          1. Comece com uma saudação de fim de dia.
          2. Apresente a porcentagem de conclusão do dia no formato: "Você completou ${completionPercentage}% do dia."
          3. Se houver tarefas pendentes ou atrasadas, liste-as de forma clara.
          4. Adicione a pergunta: "Quer reagendar o restante?".
          5. Termine com uma mensagem relaxante para a noite.
          6. Use markdown para formatação. Seja breve e direto ao ponto.
        `;
      }

      const chatCompletion = await aiClient.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: modelName,
        temperature: 0.7,
        max_tokens: 500,
      });

      briefMessage = chatCompletion.choices[0].message.content || "Não foi possível gerar o resumo com IA.";
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

    return new Response(JSON.stringify({ message: "Brief diário/notificação de teste processado com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na Edge Function daily-brief:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});