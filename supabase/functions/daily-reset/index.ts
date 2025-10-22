import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, subDays, isToday, parseISO, getDay, isBefore, startOfDay, isSameMonth, addMonths } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime, zonedTimeToUtc } from "https://esm.sh/date-fns-tz@3.0.1";

const allowedOrigins = ['http://localhost:32100', 'https://nexusflow.vercel.app'];

serve(async (req) => {
  const origin = req.headers.get("origin");
  const isAllowedOrigin = allowedOrigins.includes(origin!);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: users, error: fetchUsersError } = await supabase
      .from('profiles')
      .select('id, timezone');

    if (fetchUsersError) throw fetchUsersError;

    for (const user of users || []) {
      const userId = user.id;
      const userTimezone = user.timezone || 'America/Sao_Paulo';
      const nowUtc = new Date();
      
      // Calcular o início do dia de HOJE no fuso horário do usuário, e converter de volta para UTC para a query
      const startOfTodayInUserTimezone = startOfDay(utcToZonedTime(nowUtc, userTimezone));
      const startOfTodayUtc = zonedTimeToUtc(startOfTodayInUserTimezone, userTimezone);
      const todayInUserTimezoneString = format(startOfTodayInUserTimezone, "yyyy-MM-dd");
      const yesterdayInUserTimezoneString = format(subDays(startOfTodayInUserTimezone, 1), "yyyy-MM-dd");

      console.log(`[User ${userId}] Executando daily-reset. Hoje (TZ): ${todayInUserTimezoneString}. Comparando com datas anteriores a: ${todayInUserTimezoneString}`);

      // --- 1. Processar Tarefas Atrasadas (Overdue) ---
      // Buscar tarefas não concluídas, não recorrentes diárias, com due_date anterior a HOJE (yyyy-MM-dd)
      const { data: pendingTasks, error: pendingTasksError } = await supabase
        .from('tasks')
        .select('id, due_date, current_board, is_completed, is_daily_recurring')
        .eq('user_id', userId)
        .eq('is_completed', false)
        .eq('is_daily_recurring', false)
        .lt('due_date', todayInUserTimezoneString); // Comparação de string ISO (yyyy-MM-dd)

      if (pendingTasksError) {
        console.error(`[User ${userId}] Erro ao buscar tarefas pendentes:`, pendingTasksError);
        continue;
      }

      const overdueUpdates = pendingTasks
        .filter(task => task.current_board !== 'overdue') // Apenas tarefas que ainda não estão no quadro de atrasadas
        .map(task => ({
          id: task.id,
          overdue: true,
          current_board: 'overdue',
          last_moved_to_overdue_at: nowUtc.toISOString(),
        }));

      if (overdueUpdates.length > 0) {
        const { error: updateOverdueError } = await supabase
          .from('tasks')
          .upsert(overdueUpdates, { onConflict: 'id' });

        if (updateOverdueError) console.error(`[User ${userId}] Erro ao atualizar tarefas atrasadas:`, updateOverdueError);
        else console.log(`[User ${userId}] Movidas ${overdueUpdates.length} tarefas para 'overdue'.`);
      }

      // --- 2. Resetar Recorrentes Diárias Inegociáveis ---
      const { data: dailyRecurringTasks, error: recurringError } = await supabase
        .from('tasks')
        .select('id, is_completed, recurrence_streak, last_completion_date, recurrence_failure_history')
        .eq('user_id', userId)
        .eq('is_daily_recurring', true);

      if (recurringError) {
        console.error(`[User ${userId}] Erro ao buscar recorrentes diárias:`, recurringError);
        continue;
      }

      const recurrenceUpdates = dailyRecurringTasks.map(task => {
        const lastCompletionDateStr = task.last_completion_date;
        const wasCompletedYesterday = lastCompletionDateStr === yesterdayInUserTimezoneString;

        let newStreak = task.recurrence_streak;
        let newFailureHistory = task.recurrence_failure_history || [];

        if (task.is_completed && wasCompletedYesterday) {
          // Se a tarefa foi concluída ontem, o streak já foi atualizado no frontend.
          // Apenas garantimos o reset do status para o novo dia.
        } else if (!task.is_completed && !wasCompletedYesterday) {
          // FALHA: Não foi concluída ontem (e não está marcada como concluída hoje)
          if (task.recurrence_streak > 0) {
            console.log(`[User ${userId}] Recorrente ${task.id} falhou. Streak resetado.`);
          }
          newStreak = 0;
          // Adicionar falha se ainda não estiver no histórico de falhas de ontem
          if (task.is_completed === false && !newFailureHistory.includes(yesterdayInUserTimezoneString)) {
             newFailureHistory = [...newFailureHistory, yesterdayInUserTimezoneString];
          }
        }

        // Resetar o status de conclusão para que apareça hoje (o novo dia)
        return {
          id: task.id,
          is_completed: false,
          recurrence_streak: newStreak,
          recurrence_failure_history: newFailureHistory,
        };
      });

      // Executar updates em lote
      if (recurrenceUpdates.length > 0) {
        const { error: updateRecurrenceError } = await supabase
          .from('tasks')
          .upsert(recurrenceUpdates, { onConflict: 'id' });

        if (updateRecurrenceError) console.error(`[User ${userId}] Erro ao atualizar recorrentes:`, updateRecurrenceError);
        else console.log(`[User ${userId}] Resetadas ${recurrenceUpdates.length} recorrentes diárias.`);
      }
    }

    return new Response(
      JSON.stringify({ message: "Daily task processing and overdue check complete." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("Erro na Edge Function daily-reset:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});