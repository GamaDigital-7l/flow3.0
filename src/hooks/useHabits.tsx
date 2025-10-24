// src/hooks/useHabits.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Habit, HabitHistoryEntry, HabitFrequency } from '@/types/habit';
import { showError, showSuccess } from '@/utils/toast';
import { format, subDays, isSameDay, getDay, differenceInDays, parseISO as dateFnsParseISO } from 'date-fns';
import { parseISO, getTodayLocalString } from '@/lib/utils'; // Usando parseISO e getTodayLocalString do utils
// Removendo importação de date-fns-tz

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
      
      // 1. Update the current instance (habit.id)
      const todayLocalString = getTodayLocalString();
      const yesterdayLocalString = format(subDays(new Date(), 1), "yyyy-MM-dd");
      
      let newTotalCompleted = habit.total_completed;
      let newStreak = habit.streak;
      let newLastCompletedDateLocal = habit.last_completed_date_local;
      
      if (completed) {
        if (!habit.completed_today) {
          newTotalCompleted += 1;
          newLastCompletedDateLocal = todayLocalString;
          
          // Se a última conclusão foi ontem, incrementa o streak
          if (habit.last_completed_date_local === yesterdayLocalString) {
            newStreak += 1;
          } else if (!habit.last_completed_date_local) {
            // Primeiro dia
            newStreak = 1;
          } else {
            // Quebrou a sequência, mas está começando uma nova hoje
            newStreak = 1;
          }
        }
      } else {
        if (habit.completed_today) {
          newTotalCompleted = Math.max(0, newTotalCompleted - 1);
          
          // Se desmarcou a conclusão de hoje, o streak e a última data precisam ser recalculados
          newLastCompletedDateLocal = habit.last_completed_date_local === todayLocalString 
            ? null // Se a última data era hoje, resetamos (o daily reset cuidará do streak)
            : habit.last_completed_date_local;
            
          // Simplificando o reset do streak: se desmarcou hoje, o streak é 0 (o daily reset cuidará do cálculo preciso)
          newStreak = 0; 
        }
      }
      
      // 2. Update the current instance (habit.id) with completion status and alert status
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
      
      // 3. Update ALL instances of this recurrence_id with the new metrics
      const { error: updateAllError } = await supabase
        .from('habits')
        .update({
          total_completed: newTotalCompleted,
          last_completed_date_local: newLastCompletedDateLocal,
          streak: newStreak,
          updated_at: new Date().toISOString(),
        })
        .eq('recurrence_id', habit.recurrence_id)
        .eq('user_id', userId);
        
      if (updateAllError) throw updateAllError;
      
      // 4. Insert/Update History
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