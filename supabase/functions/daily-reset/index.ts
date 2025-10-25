import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, subDays, isToday, parseISO, isBefore, startOfDay } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@3.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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
      const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
      const todayInUserTimezoneString = format(nowInUserTimezone, "yyyy-MM-dd");

      console.log(`[User ${userId}] Executando daily-reset. Hoje (TZ): ${todayInUserTimezoneString} no fuso horário ${userTimezone}.`);

      // 1. Processar Tarefas Atrasadas (Overdue)
      // Busca tarefas não concluídas cuja data de vencimento é anterior a HOJE.
      const { data: pendingTasks, error: pendingTasksError } = await supabase
        .from('tasks')
        .select('id, due_date, current_board, is_completed, recurrence_type')
        .eq('user_id', userId)
        .eq('is_completed', false)
        .lt('due_date', todayInUserTimezoneString); // due_date < HOJE

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