// src/hooks/useHabits.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Habit, HabitHistoryEntry, HabitFrequency } from '@/types/habit';
import { showError, showSuccess } from '@/utils/toast';
import { format, subDays, isSameDay, getDay, parseISO, differenceInDays } from 'date-fns';
import dateFnsTz from 'date-fns-tz'; // Importação padrão

// Acessando a função utcToZonedTime através da propriedade default
const utcToZonedTime = dateFnsTz.utcToZonedTime || (dateFnsTz as any).default.utcToZonedTime;

// Fetch the user's timezone from profile
const fetchUserTimezone = async (userId: string): Promise<string> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.timezone || 'America/Sao_Paulo';
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

// Fetch today's active habit instances
const fetchTodayHabits = async (userId: string): Promise<Habit[]> => {
  const timezone = await fetchUserTimezone(userId);
  const nowInUserTimezone = utcToZonedTime(new Date(), timezone);
  const todayLocal = format(nowInUserTimezone, "yyyy-MM-dd");

  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', userId)
    .eq('date_local', todayLocal)
    .eq('paused', false)
    .order('created_at', { ascending: true });

  if (error) throw error;
  
  // Filter only eligible habits for today
  return (data as Habit[] || []).filter(h => 
    isDayEligible(parseISO(h.date_local), h.frequency, h.weekdays)
  );
};

// Fetch all unique habit definitions (latest instance for metrics)
const fetchAllHabitDefinitions = async (userId: string): Promise<Habit[]> => {
  // Use RPC to get the latest instance for each recurrence_id
  const { data: latestHabits, error } = await supabase.rpc('get_latest_habit_instances', { user_id_input: userId });
  
  if (error) {
    console.error("Error fetching latest habit instances via RPC:", error);
    throw error;
  }
  
  return latestHabits as Habit[] || [];
};

export const useTodayHabits = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data, isLoading, error, refetch } = useQuery<Habit[], Error>({
    queryKey: ["todayHabits", userId],
    queryFn: () => fetchTodayHabits(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return { todayHabits: data, isLoading, error, refetch };
};

export const useAllHabitDefinitions = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data, isLoading, error, refetch } = useQuery<Habit[], Error>({
    queryKey: ["allHabitDefinitions", userId],
    queryFn: () => fetchAllHabitDefinitions(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  return { habitDefinitions: data, isLoading, error, refetch };
};

// Mutation for completing/uncompleting a habit instance
export const useToggleHabitCompletion = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ habit, completed }: { habit: Habit, completed: boolean }) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      
      const timezone = await fetchUserTimezone(userId);
      const nowInUserTimezone = utcToZonedTime(new Date(), timezone);
      const todayLocal = format(nowInUserTimezone, "yyyy-MM-dd");
      const tomorrowLocal = format(subDays(nowInUserTimezone, -1), "yyyy-MM-dd");
      
      // 1. Update the current instance (habit.id)
      const { data: updatedInstance, error: updateError } = await supabase
        .from('habits')
        .update({ 
          completed_today: completed, 
          alert: false, // Clear alert on action
          updated_at: new Date().toISOString() 
        })
        .eq('id', habit.id)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (updateError) throw updateError;
      
      // 2. Insert/Update History
      const historyPayload = {
        recurrence_id: habit.recurrence_id,
        user_id: userId,
        date_local: habit.date_local,
        completed: completed,
      };
      
      const { error: historyError } = await supabase
        .from('habit_history')
        .upsert(historyPayload, { onConflict: 'recurrence_id, user_id, date_local' });
        
      if (historyError) console.error("Error updating habit history:", historyError);
      
      // 3. Create/Ensure Tomorrow's Instance exists (only if completing today)
      if (completed && isSameDay(parseISO(habit.date_local), parseISO(todayLocal))) {
        // We rely on the daily job to handle eligibility, but we ensure tomorrow's instance exists if completed today.
        
        // Check if tomorrow's instance already exists
        const { data: existingTomorrow, error: checkError } = await supabase
          .from('habits')
          .select('id')
          .eq('recurrence_id', habit.recurrence_id)
          .eq('user_id', userId)
          .eq('date_local', tomorrowLocal)
          .limit(1);
          
        if (checkError) console.error("Error checking tomorrow's habit:", checkError);

        if (!existingTomorrow || existingTomorrow.length === 0) {
          // Inherit metrics from the current instance (which is the latest completed state)
          const newStreak = habit.streak + 1;
          const newTotalCompleted = habit.total_completed + 1;
          
          const tomorrowPayload = {
            recurrence_id: habit.recurrence_id,
            user_id: userId,
            title: habit.title,
            description: habit.description,
            frequency: habit.frequency,
            weekdays: habit.weekdays,
            paused: habit.paused,
            completed_today: false,
            date_local: tomorrowLocal,
            last_completed_date_local: todayLocal,
            streak: newStreak,
            total_completed: newTotalCompleted,
            missed_days: habit.missed_days,
            fail_by_weekday: habit.fail_by_weekday,
            success_rate: habit.success_rate, // Will be recalculated by client/job
            alert: false,
          };
          
          const { error: insertTomorrowError } = await supabase
            .from('habits')
            .insert(tomorrowPayload);
            
          if (insertTomorrowError) console.error("Error inserting tomorrow's habit:", insertTomorrowError);
        }
      }
      
      // 4. Trigger metric recalculation (client-side logic for streak/total update)
      // Since we updated the history, we can now trigger a refetch of all definitions
      // to get the latest metrics (which should be updated by the DB triggers/logic, 
      // but since we rely on the client to refresh the view).
      
      return updatedInstance;
    },
    onSuccess: (data, variables) => {
      showSuccess(`Hábito ${variables.completed ? 'concluído' : 'revertido'} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["todayHabits", userId] });
      queryClient.invalidateQueries({ queryKey: ["allHabitDefinitions", userId] });
    },
    onError: (error: any) => {
      showError("Erro ao atualizar hábito: " + error.message);
    },
  });
};