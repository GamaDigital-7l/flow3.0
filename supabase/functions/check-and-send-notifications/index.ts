import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, isSameMinute, parseISO, setHours, setMinutes, getDay, isSameDay, isBefore, startOfDay } from "https://esm.sh/date-fns@3.6.0";
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Buscar todos os usuários com configurações de notificação
    const { data: usersWithSettings, error: fetchUsersError } = await supabase
      .from('settings')
      .select(`
        user_id,
        telegram_enabled,
        webpush_enabled,
        daily_brief_morning_time,
        daily_brief_evening_time,
        weekly_brief_day,
        weekly_brief_time,
        profiles(timezone)
      `);

    if (fetchUsersError) throw fetchUsersError;

    for (const setting of usersWithSettings || []) {
      const userId = setting.user_id;
      const userTimezone = setting.profiles?.timezone || "America/Sao_Paulo"; // Fallback timezone

      const nowUtc = new Date();
      const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
      const currentDayOfWeekInUserTimezone = getDay(nowInUserTimezone); // 0 para domingo, 1 para segunda, etc.

      // --- 1. Verificar e enviar Brief Diário (Manhã) ---
      if (setting.daily_brief_morning_time) {
        const [morningHour, morningMinute] = setting.daily_brief_morning_time.split(':').map(Number);
        const scheduledMorningTime = setMinutes(setHours(nowInUserTimezone, morningHour), morningMinute);

        // Verificar se é o minuto exato e se já não foi enviado hoje
        const { data: lastNotification, error: fetchLastMorningBriefError } = await supabase
          .from('settings')
          .select('last_daily_morning_brief_sent_at')
          .eq('user_id', userId)
          .single();

        if (fetchLastMorningBriefError && fetchLastMorningBriefError.code !== 'PGRST116') {
          console.error(`[User ${userId}] Erro ao buscar last_daily_morning_brief_sent_at:`, fetchLastMorningBriefError);
        }

        const lastSentMorningBrief = lastNotification?.last_daily_morning_brief_sent_at ? utcToZonedTime(parseISO(lastNotification.last_daily_morning_brief_sent_at), userTimezone) : null;
        const hasSentMorningBriefToday = lastSentMorningBrief && isSameDay(lastSentMorningBrief, nowInUserTimezone);

        if (isSameMinute(nowInUserTimezone, scheduledMorningTime) && !hasSentMorningBriefToday) {
          console.log(`[User ${userId}] Enviando brief da manhã...`);
          const { error: invokeError } = await supabase.functions.invoke('daily-brief', {
            body: { timeOfDay: 'morning', userId: userId }, // Passar userId no corpo
          });
          if (invokeError) {
            console.error(`[User ${userId}] Erro ao invocar daily-brief (manhã):`, invokeError);
          } else {
            // Atualizar last_daily_morning_brief_sent_at
            await supabase.from('settings').update({ last_daily_morning_brief_sent_at: nowUtc.toISOString() }).eq('user_id', userId);
          }
        }
      }

      // --- 2. Verificar e enviar Brief Diário (Noite) ---
      if (setting.daily_brief_evening_time) {
        const [eveningHour, eveningMinute] = setting.daily_brief_evening_time.split(':').map(Number);
        const scheduledEveningTime = setMinutes(setHours(nowInUserTimezone, eveningHour), eveningMinute);

        const { data: lastNotification, error: fetchLastEveningBriefError } = await supabase
          .from('settings')
          .select('last_daily_evening_brief_sent_at')
          .eq('user_id', userId)
          .single();

        if (fetchLastEveningBriefError && fetchLastEveningBriefError.code !== 'PGRST116') {
          console.error(`[User ${userId}] Erro ao buscar last_daily_evening_brief_sent_at:`, fetchLastEveningBriefError);
        }

        const lastSentEveningBrief = lastNotification?.last_daily_evening_brief_sent_at ? utcToZonedTime(parseISO(lastNotification.last_daily_evening_brief_sent_at), userTimezone) : null;
        const hasSentEveningBriefToday = lastSentEveningBrief && isSameDay(lastSentEveningBrief, nowInUserTimezone);

        if (isSameMinute(nowInUserTimezone, scheduledEveningTime) && !hasSentEveningBriefToday) {
          console.log(`[User ${userId}] Enviando brief da noite...`);
          const { error: invokeError } = await supabase.functions.invoke('daily-brief', {
            body: { timeOfDay: 'evening', userId: userId }, // Passar userId no corpo
          });
          if (invokeError) {
            console.error(`[User ${userId}] Erro ao invocar daily-brief (noite):`, invokeError);
          } else {
            await supabase.from('settings').update({ last_daily_evening_brief_sent_at: nowUtc.toISOString() }).eq('user_id', userId);
          }
        }
      }

      // --- 3. Verificar e enviar Resumo Semanal ---
      if (setting.weekly_brief_day && setting.weekly_brief_time) {
        const [weeklyHour, weeklyMinute] = setting.weekly_brief_time.split(':').map(Number);
        const scheduledWeeklyTime = setMinutes(setHours(nowInUserTimezone, weeklyHour), weeklyMinute);
        const scheduledWeeklyDayIndex = DAYS_OF_WEEK_MAP[setting.weekly_brief_day];

        const { data: lastNotification, error: fetchLastWeeklyBriefError } = await supabase
          .from('settings')
          .select('last_weekly_brief_sent_at')
          .eq('user_id', userId)
          .single();

        if (fetchLastWeeklyBriefError && fetchLastWeeklyBriefError.code !== 'PGRST116') {
          console.error(`[User ${userId}] Erro ao buscar last_weekly_brief_sent_at:`, fetchLastWeeklyBriefError);
        }

        const lastSentWeeklyBrief = lastNotification?.last_weekly_brief_sent_at ? utcToZonedTime(parseISO(lastNotification.last_weekly_brief_sent_at), userTimezone) : null;
        const hasSentWeeklyBriefThisWeek = lastSentWeeklyBrief && isSameDay(lastSentWeeklyBrief, nowInUserTimezone); // Simplificado para isSameDay por enquanto

        if (
          currentDayOfWeekInUserTimezone === scheduledWeeklyDayIndex &&
          isSameMinute(nowInUserTimezone, scheduledWeeklyTime) &&
          !hasSentWeeklyBriefThisWeek
        ) {
          console.log(`[User ${userId}] Enviando resumo semanal...`);
          const { error: invokeError } = await supabase.functions.invoke('weekly-brief', {
            body: { type: 'weekly_brief', userId: userId }, // Passar userId no corpo
          });
          if (invokeError) {
            console.error(`[User ${userId}] Erro ao invocar weekly-brief:`, invokeError);
          } else {
            await supabase.from('settings').update({ last_weekly_brief_sent_at: nowUtc.toISOString() }).eq('user_id', userId);
          }
        }
      }

      // --- 4. Verificar e enviar Notificações de Tarefas Recorrentes ---
      const { data: recurringTasks, error: fetchTasksError } = await supabase
        .from('tasks')
        .select('id, title, recurrence_type, recurrence_details, recurrence_time, last_notified_at, is_completed')
        .eq('user_id', userId)
        .not('recurrence_type', 'eq', 'none')
        .not('recurrence_time', 'is', null)
        .eq('is_completed', false); // Apenas tarefas não concluídas

      if (fetchTasksError) {
        console.error(`[User ${userId}] Erro ao buscar tarefas recorrentes para notificação:`, fetchTasksError);
        continue;
      }

      for (const task of recurringTasks || []) {
        if (!task.recurrence_time) continue;

        const [hour, minute] = task.recurrence_time.split(':').map(Number);
        let scheduledTimeInUserTimezone = setMinutes(setHours(nowInUserTimezone, hour), minute);

        const lastNotifiedDate = task.last_notified_at ? utcToZonedTime(parseISO(task.last_notified_at), userTimezone) : null;
        const hasBeenNotifiedToday = lastNotifiedDate && isSameDay(lastNotifiedDate, nowInUserTimezone);

        // Verificar se é o minuto exato e se não foi notificado hoje
        if (isSameMinute(nowInUserTimezone, scheduledTimeInUserTimezone) && !hasBeenNotifiedToday) {
          console.log(`[User ${userId}] Enviando notificação para tarefa recorrente ${task.id}...`);
          const { error: invokeError } = await supabase.functions.invoke('send-recurring-task-notification', {
            body: { taskId: task.id, userId: userId },
            // Não passar Authorization header aqui, pois a função send-recurring-task-notification
            // já está configurada para usar o service role key quando userId é passado no body.
          });
          if (invokeError) {
            console.error(`[User ${userId}] Erro ao invocar send-recurring-task-notification para tarefa ${task.id}:`, invokeError);
          } else {
            // Atualizar last_notified_at na tarefa
            await supabase.from('tasks').update({ last_notified_at: nowUtc.toISOString() }).eq('id', task.id);
          }
        }
      }

      // --- 5. Verificar e enviar Notificações de Lembrete de Notas ---
      const { data: notesWithReminders, error: fetchNotesError } = await supabase
        .from('notes')
        .select('id, title, reminder_date, reminder_time, updated_at')
        .eq('user_id', userId)
        .not('reminder_date', 'is', null)
        .not('reminder_time', 'is', null)
        .eq('trashed', false)
        .eq('archived', false);

      if (fetchNotesError) {
        console.error(`[User ${userId}] Erro ao buscar notas com lembretes:`, fetchNotesError);
        continue;
      }

      for (const note of notesWithReminders || []) {
        if (!note.reminder_date || !note.reminder_time) continue;

        const reminderDate = parseISO(note.reminder_date);
        const [hour, minute] = note.reminder_time.split(':').map(Number);
        
        // Criar a data/hora do lembrete no fuso horário do usuário
        let scheduledReminderTime = setMinutes(setHours(reminderDate, hour), minute);
        
        // Verificar se a data do lembrete é hoje
        if (isSameDay(scheduledReminderTime, nowInUserTimezone)) {
          // Verificar se a hora do lembrete é agora (ou já passou, mas está no mesmo minuto)
          if (isSameMinute(nowInUserTimezone, scheduledReminderTime) || (isBefore(scheduledReminderTime, nowInUserTimezone) && isSameMinute(scheduledReminderTime, nowInUserTimezone))) {
            
            // Para evitar duplicatas, usamos o updated_at da nota como um proxy para a última vez que o lembrete foi acionado.
            // Se a nota foi atualizada após o lembrete ter sido acionado hoje, acionamos novamente.
            // Caso contrário, se o lembrete já foi acionado hoje, pulamos.
            
            // Simplificando: se a hora do lembrete é agora, enviamos.
            console.log(`[User ${userId}] Enviando lembrete para nota ${note.id}...`);
            
            const { error: invokeError } = await supabase.functions.invoke('send-note-reminder', {
              body: { noteId: note.id, userId: userId },
            });
            
            if (invokeError) {
              console.error(`[User ${userId}] Erro ao invocar send-note-reminder para nota ${note.id}:`, invokeError);
            }
            
            // NOTA: Não atualizamos a nota aqui para não interferir no fluxo do usuário.
            // A Edge Function send-note-reminder deve ser idempotente ou o agendamento deve ser preciso.
          }
        }
      }
    }

    return new Response(JSON.stringify({ message: "Notification check and send process completed for all users." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function check-and-send-notifications:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});