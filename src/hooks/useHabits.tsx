// src/hooks/useHabits.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Habit, HabitHistoryEntry, HabitFrequency } from '@/types/habit';
import { showError, showSuccess } from '@/utils/toast';
import { format, subDays, isSameDay, getDay, parseISO, differenceInDays, addDays } from 'date-fns';
import { parseISO as parseISOFromUtils, getLocalTimezone } from '@/lib/utils'; // Usando parseISO e getLocalTimezone do utils

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
  const userTimezone = await fetchUserTimezone(userId);
  
  // Usando Intl.DateTimeFormat para obter a data local correta no formato YYYY-MM-DD
  const now = new Date();
  const todayLocal = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: userTimezone }).format(now); // Formato YYYY-MM-DD

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
    isDayEligible(parseISOFromUtils(h.date_local), h.frequency, h.weekdays)
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
      const now = new Date();
      const todayLocal = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone }).format(now);
      const tomorrowLocal = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone }).format(addDays(now, 1));
      
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
      
      // 3. Update Metrics and Create Tomorrow's Instance (if completing today)
      if (completed && habit.date_local === todayLocal) {
        
        // Fetch the latest metrics again to ensure consistency
        const { data: latestHabitData } = await supabase
          .from('habits')
          .select('*')
          .eq('recurrence_id', habit.recurrence_id)
          .eq('user_id', userId)
          .order('date_local', { ascending: false })
          .limit(1)
          .single();
          
        if (latestHabitData) {
          const newStreak = latestHabitData.streak + 1;
          const newTotalCompleted = latestHabitData.total_completed + 1;
          
          // Update metrics on the latest instance (which is today's instance)
          const { error: metricUpdateError } = await supabase
            .from('habits')
            .update({
              streak: newStreak,
              total_completed: newTotalCompleted,
              last_completed_date_local: todayLocal,
              updated_at: new Date().toISOString(),
            })
            .eq('id', latestHabitData.id)
            .eq('user_id', userId);
            
          if (metricUpdateError) console.error("Error updating metrics on today's habit:", metricUpdateError);

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
            const isEligibleTomorrow = isDayEligible(parseISOFromUtils(tomorrowLocal), latestHabitData.frequency, latestHabitData.weekdays);
            
            if (isEligibleTomorrow) {
              // Create new instance for tomorrow, inheriting updated metrics
              const tomorrowPayload = {
                recurrence_id: latestHabitData.recurrence_id,
                user_id: userId,
                title: latestHabitData.title,
                description: latestHabitData.description,
                frequency: latestHabitData.frequency,
                weekdays: latestHabitData.weekdays,
                paused: latestHabitData.paused,
                completed_today: false,
                date_local: tomorrowLocal,
                last_completed_date_local: todayLocal,
                streak: newStreak,
                total_completed: newTotalCompleted,
                missed_days: latestHabitData.missed_days,
                fail_by_weekday: latestHabitData.fail_by_weekday,
                success_rate: latestHabitData.success_rate, 
                alert: false,
              };
              
              const { error: insertTomorrowError } = await supabase
                .from('habits')
                .insert(tomorrowPayload);
                
              if (insertTomorrowError) console.error("Error inserting tomorrow's habit:", insertTomorrowError);
            }
          }
        }
      }
      
      // 4. Invalidate queries to refresh UI
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