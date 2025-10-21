import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, subDays, isToday, parseISO, isBefore, startOfDay } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@3.0.1";

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

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    // Usar a chave de serviço para acesso irrestrito (necessário para processar todos os usuários)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Obter todos os usuários para processar por fuso horário
    const { data: users, error: fetchUsersError } = await supabase
      .from('profiles')
      .select('id, timezone');

    if (fetchUsersError) throw fetchUsersError;

    for (const user of users || []) {
      const userId = user.id;
      const userTimezone = user.timezone || 'America/Sao_Paulo'; // Fallback para São Paulo

      const nowUtc = new Date();
      const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
      const yesterdayInUserTimezone = format(subDays(nowInUserTimezone, 1), "yyyy-MM-dd", { timeZone: userTimezone });

      console.log(`[User ${userId}] Executando daily-task-processor para o dia: ${format(nowInUserTimezone, "yyyy-MM-dd")} no fuso horário ${userTimezone}.`);

      // 1. Processar Recorrentes Diárias Inegociáveis
      const { data: dailyRecurringTasks, error: recurringError } = await supabase
        .from('tasks')
        .select('id, user_id, is_completed, recurrence_streak, last_completion_date, recurrence_failure_history')
        .eq('user_id', userId)
        .eq('is_daily_recurring', true);

      if (recurringError) throw recurringError;

      const updates = dailyRecurringTasks.map(task => {
        const lastCompletionDateStr = task.last_completion_date;
        const wasCompletedYesterday = lastCompletionDateStr === yesterdayInUserTimezone;

        let newStreak = task.recurrence_streak;
        let newFailureHistory = task.recurrence_failure_history || [];

        if (task.is_completed && wasCompletedYesterday) {
          // Se a tarefa foi concluída ontem, o streak já foi atualizado no frontend.
          // Não fazemos nada com o streak aqui, apenas garantimos o reset do status.
        } else if (!task.is_completed && !wasCompletedYesterday) {
          // FALHA: Não foi concluída ontem (e não está marcada como concluída hoje)
          if (task.recurrence_streak > 0) {
            console.log(`[User ${userId}] Recorrente ${task.id} falhou. Streak resetado.`);
          }
          newStreak = 0;
          // Adicionar falha se ainda não estiver no histórico de falhas de ontem
          if (!newFailureHistory.includes(yesterdayInUserTimezone)) {
            newFailureHistory = [...newFailureHistory, yesterdayInUserTimezone];
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
      if (updates.length > 0) {
        const { error: updateRecurrenceError } = await supabase
          .from('tasks')
          .upsert(updates, { onConflict: 'id' });

        if (updateRecurrenceError) console.error(`[User ${userId}] Erro ao atualizar recorrentes:`, updateRecurrenceError);
      }
    }

    return new Response(
      JSON.stringify({ message: "Daily task processing complete." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("Erro na Edge Function daily-task-processor:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});