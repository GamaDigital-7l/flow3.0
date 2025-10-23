// src/hooks/useHabits.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Habit, HabitHistoryEntry, HabitFrequency } from '@/types/habit';
import { showError, showSuccess } from '@/utils/toast';
import { format, subDays, isSameDay, getDay, parseISO, differenceInDays } from 'date-fns';
// Removido: import { utcToZonedTime } from 'date-fns-tz';
import { parseISO as parseISOFromUtils, getLocalTimezone } from '@/lib/utils'; // Usando parseISO e getLocalTimezone do utils

// Fetch the user's timezone from profile (mantido para consistência com o DB, mas usaremos o local para o cálculo de 'hoje')
const fetchUserTimezone = async (userId: string): Promise<string> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.timezone || getLocalTimezone(); // Fallback para o fuso horário do navegador
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
  // Usamos o fuso horário do navegador para determinar o 'hoje' local
  const timezone = getLocalTimezone();
  
  // Calcula o 'hoje' local usando o fuso horário do navegador
  // Nota: O format do date-fns não suporta timeZone diretamente, mas o DB armazena date_local (YYYY-MM-DD).
  // Para obter o YYYY-MM-DD correto, precisamos de uma data que reflita o fuso horário.
  // Como o DB armazena o fuso horário do usuário, vamos buscar o fuso horário do perfil
  // e usar a lógica de conversão de fuso horário (que agora está no servidor/Edge Functions).
  // No frontend, vamos confiar que o DB/Edge Function criou a instância correta para o dia.
  
  // Para o frontend, vamos usar a data local do navegador para a chave de cache, mas o fetch
  // deve ser baseado na data local do usuário (que é o que o DB usa).
  
  // Vamos simplificar: se o usuário não tem timezone definido, usamos o local.
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
      
      // Usando Intl.DateTimeFormat para obter a data local correta no formato YYYY-MM-DD
      const now = new Date();
      const todayLocal = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone }).format(now);
      
      // Para calcular o amanhã, precisamos de uma data que reflita o fuso horário.
      // Vamos usar a data de hoje e adicionar um dia, formatando no fuso horário.
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowLocal = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone }).format(tomorrow);
      
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
      if (completed && habit.date_local === todayLocal) {
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
          // Fetch the latest metrics again to ensure consistency before creating tomorrow's instance
          const { data: latestHabitData } = await supabase
            .from('habits')
            .select('*')
            .eq('recurrence_id', habit.recurrence_id)
            .eq('user_id', userId)
            .order('date_local', { ascending: false })
            .limit(1)
            .single();
            
          if (latestHabitData) {
            // Recalculate streak and total completed based on the latest data
            const newStreak = latestHabitData.streak + 1;
            const newTotalCompleted = latestHabitData.total_completed + 1;
            
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
              success_rate: latestHabitData.success_rate, // Will be recalculated by client/job
              alert: false,
            };
            
            const { error: insertTomorrowError } = await supabase
              .from('habits')
              .insert(tomorrowPayload);
              
            if (insertTomorrowError) console.error("Error inserting tomorrow's habit:", insertTomorrowError);
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