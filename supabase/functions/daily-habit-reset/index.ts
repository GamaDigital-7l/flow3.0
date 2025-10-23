import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, parseISO, subDays, getDay, isSameDay } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@3.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      // Usando America/Sao_Paulo como fallback, conforme solicitado
      const userTimezone = user.timezone || 'America/Sao_Paulo'; 

      const nowUtc = new Date();
      const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
      
      // Yesterday and Today in user's local date string (YYYY-MM-DD)
      const todayLocal = format(nowInUserTimezone, "yyyy-MM-dd");
      const yesterdayLocal = format(subDays(nowInUserTimezone, 1), "yyyy-MM-dd");
      const yesterdayLocalDate = parseISO(yesterdayLocal);

      console.log(`[User ${userId}] Running habit reset for ${todayLocal} (TZ: ${userTimezone}).`);

      // 1. Fetch the latest instance for all habits (to get the most recent metrics)
      const { data: baseHabits, error: fetchBaseHabitsError } = await supabase
          .rpc('get_latest_habit_instances', { user_id_input: userId });

      if (fetchBaseHabitsError) {
          console.error(`[User ${userId}] Error fetching base habits via RPC:`, fetchBaseHabitsError);
          continue;
      }
      
      const updates = [];
      const historyInserts = [];
      const newInstancesToInsert = [];
      const recurrenceIdsToProcess = new Set<string>();

      for (const baseHabit of baseHabits) {
        recurrenceIdsToProcess.add(baseHabit.recurrence_id);
        const habitDateLocal = parseISO(baseHabit.date_local);
        const weekdays = baseHabit.weekdays || [];
        
        // --- A. Process Yesterday's Habit (Missed Day Check) ---
        // Only process if the latest instance is for yesterday and it was eligible
        if (isSameDay(habitDateLocal, yesterdayLocalDate)) {
          const isEligibleYesterday = isDayEligible(yesterdayLocalDate, baseHabit.frequency, weekdays);
          
          if (isEligibleYesterday && !baseHabit.completed_today && !baseHabit.paused) {
            // Missed Day: Update metrics on the yesterday's instance
            const habitUpdates: any = { id: baseHabit.id, updated_at: nowUtc.toISOString() };
            habitUpdates.streak = 0;
            habitUpdates.missed_days = [...baseHabit.missed_days, baseHabit.date_local];
            
            // Update fail_by_weekday
            const dayOfWeek = getDay(yesterdayLocalDate);
            const currentFails = baseHabit.fail_by_weekday[dayOfWeek] || 0;
            habitUpdates.fail_by_weekday = {
              ...baseHabit.fail_by_weekday,
              [dayOfWeek]: currentFails + 1,
            };
            habitUpdates.alert = true; 
            updates.push(habitUpdates);
            
            // Insert history entry for missed day
            historyInserts.push({
              recurrence_id: baseHabit.recurrence_id,
              user_id: userId,
              date_local: baseHabit.date_local,
              completed: false,
            });
            console.log(`[User ${userId}] Habit ${baseHabit.title} missed on ${yesterdayLocal}. Streak reset.`);
          } else if (isEligibleYesterday && baseHabit.completed_today) {
            // If completed yesterday, ensure alert is false
            const habitUpdates: any = { id: baseHabit.id, updated_at: nowUtc.toISOString(), alert: false };
            updates.push(habitUpdates);
          }
        }
        
        // --- B. Ensure Today's Instance Exists (if eligible) ---
        if (!isSameDay(habitDateLocal, parseISO(todayLocal))) {
            const isEligibleToday = isDayEligible(nowInUserTimezone, baseHabit.frequency, weekdays);
            
            if (isEligibleToday && !baseHabit.paused) {
                // Create new instance for today, inheriting metrics from the latest instance
                // Note: If yesterday was missed, the metrics (streak, missed_days, fail_by_weekday) 
                // should be the updated ones from step A, but since we are iterating over baseHabits 
                // fetched before step A, we must rely on the DB update in step 2 to fix the metrics 
                // for the new instance later, or fetch the updated metrics. 
                // For simplicity and performance, we rely on the client to fetch the final state.
                
                // We set the alert based on the *current* streak (which might be 0 if yesterday was missed)
                const alertStatus = baseHabit.streak === 0 && isSameDay(habitDateLocal, yesterdayLocalDate) && !baseHabit.completed_today;

                newInstancesToInsert.push({
                    recurrence_id: baseHabit.recurrence_id,
                    user_id: userId,
                    title: baseHabit.title,
                    description: baseHabit.description,
                    frequency: baseHabit.frequency,
                    weekdays: baseHabit.weekdays,
                    paused: baseHabit.paused,
                    completed_today: false,
                    date_local: todayLocal,
                    last_completed_date_local: baseHabit.last_completed_date_local,
                    streak: baseHabit.streak,
                    total_completed: baseHabit.total_completed,
                    missed_days: baseHabit.missed_days,
                    fail_by_weekday: baseHabit.fail_by_weekday,
                    success_rate: baseHabit.success_rate,
                    alert: alertStatus,
                });
            }
        }
      }

      // 2. Batch Update Habits (Yesterday's metrics and Today's alerts)
      if (updates.length > 0) {
        const { error: updateHabitsError } = await supabase
          .from('habits')
          .upsert(updates, { onConflict: 'id' });
        if (updateHabitsError) console.error(`[User ${userId}] Error updating habits:`, updateHabitsError);
        else console.log(`[User ${userId}] Updated ${updates.length} habit instances (yesterday metrics/alerts).`);
      }
      
      // 3. Batch Insert History (Missed days)
      if (historyInserts.length > 0) {
        const { error: insertHistoryError } = await supabase
          .from('habit_history')
          .insert(historyInserts);
        if (insertHistoryError) console.error(`[User ${userId}] Error inserting habit history:`, insertHistoryError);
        else console.log(`[User ${userId}] Inserted ${historyInserts.length} history entries.`);
      }
      
      // 4. Batch Insert Today's New Instances
      if (newInstancesToInsert.length > 0) {
          const { error: insertNewError } = await supabase
              .from('habits')
              .insert(newInstancesToInsert);
          if (insertNewError) console.error(`[User ${userId}] Error inserting new today instances:`, insertNewError);
          else console.log(`[User ${userId}] Created ${newInstancesToInsert.length} new habit instances for today.`);
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