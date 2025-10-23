import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, parseISO, subDays, getDay, isSameDay } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@2.0.1";

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
      
      const todayLocal = format(nowInUserTimezone, "yyyy-MM-dd");
      const yesterdayLocal = format(subDays(nowInUserTimezone, 1), "yyyy-MM-dd");
      const todayLocalDate = parseISO(todayLocal);
      const yesterdayLocalDate = parseISO(yesterdayLocal);

      console.log(`[User ${userId}] Running habit reset for ${todayLocal} (TZ: ${userTimezone}).`);

      // 1. Fetch all active habits that belong to yesterday
      const { data: yesterdayHabits, error: fetchHabitsError } = await supabase
        .from('user_habits') // MUDANÇA: Nova tabela
        .select('*')
        .eq('user_id', userId)
        .eq('paused', false)
        .eq('date_local', yesterdayLocal);

      if (fetchHabitsError) {
        console.error(`[User ${userId}] Error fetching yesterday habits:`, fetchHabitsError);
        continue;
      }

      const updates = [];
      const historyInserts = [];
      
      for (const habit of yesterdayHabits || []) {
        const habitUpdates: any = { id: habit.id, updated_at: nowUtc.toISOString() };
        const habitDateLocal = parseISO(habit.date_local);
        const weekdays = habit.weekdays || [];
        const isEligible = isDayEligible(habitDateLocal, habit.frequency, weekdays);

        // --- A. Handle Yesterday's Habit (Missed Day Check) ---
        if (isEligible && !habit.completed_today) {
          // 1. Missed Day: Update metrics (Streak reset, missed day count)
          habitUpdates.streak = 0;
          habitUpdates.alert = true; // Set alert for missed day
          
          // Update missed_days array
          if (!habit.missed_days.includes(habit.date_local)) {
            habitUpdates.missed_days = [...habit.missed_days, habit.date_local];
          } else {
            habitUpdates.missed_days = habit.missed_days; // Already missed, keep array
          }
          
          // Update fail_by_weekday
          const dayOfWeek = getDay(habitDateLocal);
          const currentFails = habit.fail_by_weekday[dayOfWeek] || 0;
          habitUpdates.fail_by_weekday = {
            ...habit.fail_by_weekday,
            [dayOfWeek]: currentFails + 1,
          };
          
          // 2. Insert history entry for missed day (if not already inserted)
          historyInserts.push({
            recurrence_id: habit.recurrence_id,
            user_id: userId,
            date_local: habit.date_local,
            completed: false,
          });
          
          console.log(`[User ${userId}] Habit ${habit.title} missed on ${yesterdayLocal}. Streak reset.`);
        } else if (isEligible && habit.completed_today) {
          // If completed yesterday, ensure alert is false
          habitUpdates.alert = false;
        }
        
        if (Object.keys(habitUpdates).length > 2) { // Check if there are actual updates besides id and updated_at
          updates.push(habitUpdates);
        }
      }

      // 2. Batch Update Habits (Yesterday's metrics)
      if (updates.length > 0) {
        const { error: updateHabitsError } = await supabase
          .from('user_habits') // MUDANÇA: Nova tabela
          .upsert(updates, { onConflict: 'id' });
        if (updateHabitsError) console.error(`[User ${userId}] Error updating habits:`, updateHabitsError);
        else console.log(`[User ${userId}] Updated ${updates.length} habit instances (yesterday's metrics).`);
      }
      
      // 3. Batch Insert History (Missed days)
      if (historyInserts.length > 0) {
        const { error: insertHistoryError } = await supabase
          .from('user_habit_history') // MUDANÇA: Nova tabela
          .upsert(historyInserts, { onConflict: 'recurrence_id, user_id, date_local' });
        if (insertHistoryError) console.error(`[User ${userId}] Error inserting habit history:`, insertHistoryError);
        else console.log(`[User ${userId}] Inserted ${historyInserts.length} history entries (missed days).`);
      }
      
      // 4. Ensure Today's Instance Exists (if eligible)
      const { data: existingTodayInstances, error: fetchExistingError } = await supabase
        .from('user_habits') // MUDANÇA: Nova tabela
        .select('recurrence_id')
        .eq('user_id', userId)
        .eq('date_local', todayLocal);
        
      if (fetchExistingError) {
        console.error(`[User ${userId}] Error fetching existing today instances:`, fetchExistingError);
      } else {
        const existingRecurrenceIds = new Set(existingTodayInstances.map(i => i.recurrence_id));
        
        const newInstancesToInsert = [];
        
        // Fetch the latest state of the base habit (the one with the highest date_local)
        const { data: baseHabits, error: fetchBaseHabitsError } = await supabase
            .rpc('get_latest_user_habit_instances', { user_id_input: userId }); // MUDANÇA: Nova função RPC

        if (fetchBaseHabitsError) {
            console.error(`[User ${userId}] Error fetching base habits via RPC:`, fetchBaseHabitsError);
        } else {
            for (const baseHabit of baseHabits) {
                if (!existingRecurrenceIds.has(baseHabit.recurrence_id)) {
                    const isEligibleToday = isDayEligible(todayLocalDate, baseHabit.frequency, baseHabit.weekdays);
                    
                    if (isEligibleToday) {
                        // Create new instance for today, inheriting metrics from the latest instance
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
                            alert: baseHabit.streak === 0, // Set alert if streak was broken yesterday
                        });
                    }
                }
            }
        }
        
        if (newInstancesToInsert.length > 0) {
            const { error: insertNewError } = await supabase
                .from('user_habits') // MUDANÇA: Nova tabela
                .insert(newInstancesToInsert);
                
            if (insertNewError) console.error(`[User ${userId}] Error inserting new today instances:`, insertNewError);
            else console.log(`[User ${userId}] Created ${newInstancesToInsert.length} new habit instances for today.`);
        }
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