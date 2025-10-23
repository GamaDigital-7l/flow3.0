// src/hooks/useHabits.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Habit, HabitHistoryEntry, HabitFrequency } from '@/types/habit';
import { showError, showSuccess } from '@/utils/toast';
import { format, subDays, isSameDay, getDay, differenceInDays } from 'date-fns';
import { parseISO, getTodayLocalString } from '@/lib/utils'; // Usando parseISO e getTodayLocalString do utils
// Removendo importação de date-fns-tz

// Fetch the user's timezone from profile (mantido para a lógica de métricas, mas não para a data de hoje)
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
  // Usamos a data local do navegador como proxy para a data local do usuário
  const todayLocal = getTodayLocalString();

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
      
      // Usando a data local do navegador para o cálculo de métricas
      const todayLocal = getTodayLocalString();
      
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
      
      // 3. Recalculate metrics and update all instances of this recurrence_id
      
      // Fetch the latest metrics from the DB (this is the most reliable way after history update)
      const { data: historyData, error: fetchHistoryError } = await supabase
        .from('habit_history')
        .select('date_local, completed')
        .eq('recurrence_id', habit.recurrence_id)
        .eq('user_id', userId)
        .order('date_local', { ascending: true });
        
      if (fetchHistoryError) throw fetchHistoryError;
      
      let newStreak = 0;
      let newTotalCompleted = 0;
      let lastCompletedDateLocal: string | null = null;
      const missedDays: string[] = [];
      const failByWeekday: { [key: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      
      const historyMap = new Map<string, boolean>();
      historyData.forEach(h => historyMap.set(h.date_local, h.completed));
      
      // Determine the range of dates to check (from habit creation up to today)
      const { data: creationData, error: fetchCreationError } = await supabase
        .from('habits')
        .select('date_local, frequency, weekdays')
        .eq('recurrence_id', habit.recurrence_id)
        .eq('user_id', userId)
        .order('date_local', { ascending: true })
        .limit(1)
        .single();
        
      if (fetchCreationError) throw fetchCreationError;
      
      const startDate = parseISO(creationData.date_local);
      let currentDate = startDate;
      
      // Iterate from start date up to today
      const endDate = parseISO(todayLocal);
      
      while (currentDate <= endDate) {
        const dateString = format(currentDate, 'yyyy-MM-dd');
        const isEligible = isDayEligible(currentDate, creationData.frequency, creationData.weekdays);
        const isCompletedOnDate = historyMap.get(dateString) === true;
        
        if (isEligible) {
          if (isCompletedOnDate) {
            newStreak++;
            newTotalCompleted++;
            lastCompletedDateLocal = dateString;
          } else {
            // Only break streak if the day is in the past (yesterday or earlier)
            if (currentDate < endDate) {
              newStreak = 0;
              missedDays.push(dateString);
              const dayOfWeek = getDay(currentDate);
              failByWeekday[dayOfWeek] = (failByWeekday[dayOfWeek] || 0) + 1;
            }
          }
        }
        currentDate = subDays(currentDate, -1); // Add one day
      }
      
      const totalEligibleDays = historyData.length; // Approximation, better calculated via DB
      const newSuccessRate = totalEligibleDays > 0 ? (newTotalCompleted / totalEligibleDays) * 100 : 0;

      // 4. Update ALL instances of this recurrence_id with the new metrics
      const { error: updateAllError } = await supabase
        .from('habits')
        .update({
          streak: newStreak,
          total_completed: newTotalCompleted,
          missed_days: missedDays,
          fail_by_weekday: failByWeekday,
          success_rate: newSuccessRate,
          last_completed_date_local: lastCompletedDateLocal,
          alert: newStreak === 0 && !completed, // Set alert if streak is broken and not completed today
          updated_at: new Date().toISOString(),
        })
        .eq('recurrence_id', habit.recurrence_id)
        .eq('user_id', userId);
        
      if (updateAllError) throw updateAllError;
      
      return updatedInstance;
    },
    onSuccess: (data, variables) => {
      showSuccess(`Hábito ${variables.completed ? 'concluído' : 'revertido'} com sucesso!`);
      // Invalidate all relevant queries to force UI update with new metrics
      queryClient.invalidateQueries({ queryKey: ["todayHabits", userId] });
      queryClient.invalidateQueries({ queryKey: ["allHabitDefinitions", userId] });
    },
    onError: (error: any) => {
      showError("Erro ao atualizar hábito: " + error.message);
    },
  });
};