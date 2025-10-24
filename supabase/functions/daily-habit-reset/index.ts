import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, parseISO, subDays, getDay, isSameDay, isBefore, startOfDay } from "https://esm.sh/date-fns@3.6.0";
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
      const userTimezone = user.timezone || 'America/Sao_Paulo'; 

      const nowUtc = new Date();
      const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
      
      const todayLocalString = format(nowInUserTimezone, "yyyy-MM-dd");
      const yesterdayLocalString = format(subDays(nowInUserTimezone, 1), "yyyy-MM-dd");
      const yesterdayLocalDate = parseISO(yesterdayLocalString);

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
      
      // Fetch existing habit instances for today to prevent duplicates
      const { data: existingTodayHabits, error: fetchExistingError } = await supabase
        .from('habits')
        .select('recurrence_id')
        .eq('user_id', userId)
        .eq('date_local', todayLocalString);
        
      if (fetchExistingError) {
          console.error(`[User ${userId}] Error fetching existing today habits:`, fetchExistingError);
          continue;
      }
      const existingRecurrenceIds = new Set(existingTodayHabits?.map(h => h.recurrence_id));


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
            // If completed yesterday, ensure alert is false and update streak if necessary
            const habitUpdates: any = { id: baseHabit.id, updated_at: nowUtc.toISOString(), alert: false };
            
            // Calculate new streak: if last completed date was yesterday, increment streak
            const lastCompletedDate = baseHabit.last_completed_date_local ? parseISO(baseHabit.last_completed_date_local) : null;
            if (lastCompletedDate && isSameDay(lastCompletedDate, yesterdayLocalDate)) {
                habitUpdates.streak = (baseHabit.streak || 0) + 1;
            }
            
            updates.push(habitUpdates);
          }
        }
        
        // --- B. Ensure Today's Instance Exists (if eligible) ---
        const isEligibleToday = isDayEligible(nowInUserTimezone, baseHabit.frequency, weekdays);
        
        if (isEligibleToday && !existingRecurrenceIds.has(baseHabit.recurrence_id)) {
            // Create new instance for today, inheriting metrics from the latest instance
            
            // Calculate success rate based on total attempts (total_completed + missed_days.length)
            const totalAttempts = baseHabit.total_completed + (baseHabit.missed_days?.length || 0);
            const successRate = totalAttempts > 0 ? (baseHabit.total_completed / totalAttempts) * 100 : 0;

            newInstancesToInsert.push({
                recurrence_id: baseHabit.recurrence_id,
                user_id: userId,
                title: baseHabit.title,
                description: baseHabit.description,
                frequency: baseHabit.frequency,
                weekdays: baseHabit.weekdays,
                paused: baseHabit.paused,
                completed_today: false,
                date_local: todayLocalString,
                
                // Inherit metrics from the latest instance
                last_completed_date_local: baseHabit.last_completed_date_local,
                streak: baseHabit.streak,
                total_completed: baseHabit.total_completed,
                missed_days: baseHabit.missed_days,
                fail_by_weekday: baseHabit.fail_by_weekday,
                success_rate: successRate, // Recalculado
                alert: false, // Novo dia, sem alerta inicial
            });
        }
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
          .upsert(historyInserts, { onConflict: 'recurrence_id, user_id, date_local' });
        if (insertHistoryError) console.error(`[User ${userId}] Error inserting habit history:`, insertHistoryError);
      }
      
      // 4. Batch Insert Today's New Instances
      if (newInstancesToInsert.length > 0) {
          const { error: insertNewError } = await supabase
              .from('habits')
              .insert(newInstancesToInsert);
          if (insertNewError) console.error(`[User ${userId}] Error inserting new today instances:`, insertNewError);
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