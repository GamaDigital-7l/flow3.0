import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, parseISO, subDays, getDay, isSameDay, isBefore, startOfDay } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@3.0.1";

const allowedOrigins = ['http://localhost:32100', 'https://nexusflow.vercel.app'];

const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
  "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
  "Thursday": 4, "Friday": 5, "Saturday": 6
};

// Helper function to check if a day is eligible based on frequency/weekdays
function isDayEligible(date: Date, frequency: string, weekdays: number[] | null): boolean {
  if (frequency === 'daily') {
    return true;
  }
  if (frequency === 'weekly' || frequency === 'custom') {
    const dayOfWeek = getDay(date); // 0 = Sunday, 6 = Saturday
    return weekdays?.includes(dayOfWeek) ?? false;
  }
  return false;
}

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch all users and their timezones
    const { data: users, error: fetchUsersError } = await supabase
      .from('profiles')
      .select('id, timezone');

    if (fetchUsersError) throw fetchUsersError;

    for (const user of users || []) {
      const userId = user.id;
      const userTimezone = user.timezone || 'America/Sao_Paulo'; 

      const nowUtc = new Date();
      const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
      
      const todayLocalString = format(nowInUserTimezone, "yyyy-MM-dd");
      const yesterdayLocalString = format(subDays(nowInUserTimezone, 1), "yyyy-MM-dd");
      const yesterdayLocalDate = parseISO(yesterdayLocalString);

      // 1. Fetch the latest instance for all habits (to process yesterday's metrics)
      const { data: baseHabits, error: fetchBaseHabitsError } = await supabase
          .rpc('get_latest_habit_instances', { user_id_input: userId });

      if (fetchBaseHabitsError) {
          console.error(`[User ${userId}] Error fetching base habits via RPC:`, fetchBaseHabitsError);
          continue;
      }
      
      const updates = [];
      const historyInserts = [];

      for (const baseHabit of baseHabits) {
        const habitDateLocal = parseISO(baseHabit.date_local);
        const weekdays = baseHabit.weekdays || [];
        
        // --- A. Process Yesterday's Habit (Missed Day Check) ---
        // Only process if the latest instance is for yesterday and it was eligible
        if (isSameDay(habitDateLocal, yesterdayLocalDate)) {
          const isEligibleYesterday = isDayEligible(yesterdayLocalDate, baseHabit.frequency, weekdays);
          
          if (isEligibleYesterday && !baseHabit.completed_today && !baseHabit.paused) {
            // Missed Day: Update metrics on the yesterday's instance
            const habitUpdates: any = { id: baseHabit.id, updated_at: nowUtc.toISOString() };
            
            // Streak reset
            habitUpdates.streak = 0;
            
            // Update missed_days
            const currentMissedDays = baseHabit.missed_days || [];
            if (!currentMissedDays.includes(baseHabit.date_local)) {
                habitUpdates.missed_days = [...currentMissedDays, baseHabit.date_local];
            } else {
                habitUpdates.missed_days = currentMissedDays;
            }
            
            // Update fail_by_weekday
            const dayOfWeek = getDay(yesterdayLocalDate);
            const currentFails = baseHabit.fail_by_weekday[dayOfWeek] || 0;
            habitUpdates.fail_by_weekday = {
              ...baseHabit.fail_by_weekday,
              [dayOfWeek]: currentFails + 1,
            };
            
            // Set alert for the missed day instance
            habitUpdates.alert = true; 
            updates.push(habitUpdates);
            
            // Insert history entry for missed day (if not already inserted)
            historyInserts.push({
              recurrence_id: baseHabit.recurrence_id,
              user_id: userId,
              date_local: baseHabit.date_local,
              completed: false,
            });
          } else if (isEligibleYesterday && baseHabit.completed_today) {
            // If completed yesterday, ensure alert is false
            const habitUpdates: any = { id: baseHabit.id, updated_at: nowUtc.toISOString(), alert: false };
            updates.push(habitUpdates);
          }
        }
        
        // --- B. Check for missed days older than yesterday ---
        // If the latest instance is older than yesterday, and it was eligible, it's a missed day.
        // This logic is complex and usually handled by a separate cleanup process. 
        // For now, we rely on the frontend to create the instance for today, and the Edge Function 
        // to only process the immediate previous day (yesterday).
      }

      // 2. Batch Update Habits (Yesterday's metrics and Today's alerts)
      if (updates.length > 0) {
        const { error: updateHabitsError } = await supabase
          .from('habits')
          .upsert(updates, { onConflict: 'id' });
        if (updateHabitsError) console.error(`[User ${userId}] Error updating habits:`, updateHabitsError);
      }
      
      // 3. Batch Insert History (Missed days)
      if (historyInserts.length > 0) {
        const { error: insertHistoryError } = await supabase
          .from('habit_history')
          .insert(historyInserts);
        if (insertHistoryError) console.error(`[User ${userId}] Error inserting habit history:`, insertHistoryError);
      }
    }

    // 4. Processar Tarefas Atrasadas (Mantido do daily-reset original)
    const { data: usersWithTimezone, error: fetchUsersTimezoneError } = await supabase
      .from('profiles')
      .select('id, timezone');

    if (fetchUsersTimezoneError) throw fetchUsersTimezoneError;

    for (const user of usersWithTimezone || []) {
      const userId = user.id;
      const userTimezone = user.timezone || 'America/Sao_Paulo';

      const nowUtc = new Date();
      const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
      const todayInUserTimezoneString = format(nowInUserTimezone, "yyyy-MM-dd");

      // Busca tarefas não concluídas cuja data de vencimento é anterior a HOJE.
      const { data: pendingTasks, error: pendingTasksError } = await supabase
        .from('tasks')
        .select('id, due_date, current_board, is_completed')
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
      JSON.stringify({ message: "Daily habit reset and metric update complete." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("Erro na Edge Function daily-habit-reset:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});