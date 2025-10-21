import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, subDays, isToday, parseISO, getDay, isBefore, startOfDay, isSameMonth, addMonths } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime, zonedTimeToUtc } from "https://esm.sh/date-fns-tz@2.0.1";

const allowedOrigins = ['http://localhost:32100', 'https://nexusflow.vercel.app'];

serve(async (req) => {
  const origin = req.headers.get("origin");
  const isAllowedOrigin = allowedOrigins.includes(origin!);

  const corsHeaders = {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin! : '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Obter todos os usuários para processar por fuso horário
    const { data: users, error: fetchUsersError } = await supabase
      .from('profiles')
      .select('id, timezone');

    if (fetchUsersError) throw fetchUsersError;

    for (const user of users || []) {
      const userId = user.id;
      const userTimezone = user.timezone || 'America/Sao_Paulo'; // Fallback para São Paulo

      const nowUtc = new Date();
      const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
      const todayInUserTimezone = format(nowInUserTimezone, "yyyy-MM-dd", { timeZone: userTimezone });
      const yesterdayInUserTimezone = format(subDays(nowInUserTimezone, 1), "yyyy-MM-dd", { timeZone: userTimezone });
      const currentDayOfWeekInUserTimezone = getDay(nowInUserTimezone); // 0 para domingo, 1 para segunda, etc.
      const currentDayOfMonthInUserTimezone = nowInUserTimezone.getDate().toString();
      const currentMonthYearRef = format(nowInUserTimezone, "yyyy-MM", { timeZone: userTimezone });
      const previousMonthYearRef = format(subDays(nowInUserTimezone, 1), "yyyy-MM", { timeZone: userTimezone });


      console.log(`[User ${userId}] Executando daily-reset para o dia: ${todayInUserTimezone} no fuso horário ${userTimezone}. Verificando tarefas de: ${yesterdayInUserTimezone}`);

      // 1. Mover tarefas não concluídas dos quadros de hoje para 'overdue'
      const { data: uncompletedTodayTasks, error: fetchUncompletedError } = await supabase
        .from('tasks')
        .select('id, title, is_completed, due_date, recurrence_type, last_successful_completion_date, origin_board, current_board, parent_task_id')
        .eq('user_id', userId)
        .in('current_board', ['today_high_priority', 'today_medium_priority', 'jobs_woe_today'])
        .eq('is_completed', false);

      if (fetchUncompletedError) throw fetchUncompletedError;

      const tasksToMoveToOverdue = uncompletedTodayTasks.filter(task => {
        // Verifica se a tarefa era para ser concluída ontem
        if (task.due_date && format(parseISO(task.due_date), "yyyy-MM-dd") === yesterdayInUserTimezone) {
          return true;
        }
        // Para tarefas recorrentes, verifica se a última conclusão foi antes de hoje
        if (task.recurrence_type !== 'none' && task.last_successful_completion_date) {
          const lastCompletionDate = parseISO(task.last_successful_completion_date);
          return isBefore(lastCompletionDate, startOfDay(nowInUserTimezone)); // Se a última conclusão foi antes do início de hoje
        }
        return false;
      });

      if (tasksToMoveToOverdue.length > 0) {
        const { error: updateOverdueError } = await supabase
          .from('tasks')
          .update({ 
            current_board: 'overdue', 
            overdue: true, // Marcar como atrasada
            last_moved_to_overdue_at: nowUtc.toISOString(),
            is_completed: false // Garante que continue como não concluída
          })
          .in('id', tasksToMoveToOverdue.map(task => task.id));
        if (updateOverdueError) throw updateOverdueError;
        console.log(`[User ${userId}] Movidas ${tasksToMoveToOverdue.length} tarefas para 'overdue'.`);
      }

      // 2. Mover tarefas concluídas dos quadros de hoje para 'completed'
      const { data: completedTodayTasks, error: fetchCompletedError } = await supabase
        .from('tasks')
        .select('id, title, is_completed, due_date, recurrence_type, last_successful_completion_date, origin_board, current_board, parent_task_id')
        .eq('user_id', userId)
        .in('current_board', ['today_high_priority', 'today_medium_priority', 'jobs_woe_today'])
        .eq('is_completed', true);

      if (fetchCompletedError) throw fetchCompletedError;

      const tasksToMoveToCompleted = completedTodayTasks.filter(task => {
        // Verifica se a tarefa foi concluída ontem
        if (task.last_successful_completion_date && format(parseISO(task.last_successful_completion_date), "yyyy-MM-dd") === yesterdayInUserTimezone) {
          return true;
        }
        return false;
      });

      if (tasksToMoveToCompleted.length > 0) {
        const { error: updateCompletedError } = await supabase
          .from('tasks')
          .update({ 
            current_board: 'completed', 
            completed_at: nowUtc.toISOString() 
          })
          .in('id', tasksToMoveToCompleted.map(task => task.id));
        if (updateCompletedError) throw updateCompletedError;
        console.log(`[User ${userId}] Movidas ${tasksToMoveToCompleted.length} tarefas para 'completed'.`);
      }

      // 3. Resetar o status 'is_completed' e 'overdue' para tarefas recorrentes que são devidas hoje
      const { data: recurrentTasks, error: fetchRecurrentError } = await supabase
        .from('tasks')
        .select('id, recurrence_type, recurrence_details, is_completed, last_successful_completion_date, parent_task_id')
        .eq('user_id', userId)
        .neq('recurrence_type', 'none');

      if (fetchRecurrentError) throw fetchRecurrentError;

      const tasksToResetCompletion = recurrentTasks.filter(task => {
        const isDayIncluded = (details: string | null | undefined, dayIndex: number) => {
          if (!details) return false;
          const days = details.split(',');
          const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
            "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
            "Thursday": 4, "Friday": 5, "Saturday": 6
          };
          return days.some(day => DAYS_OF_WEEK_MAP[day] === dayIndex);
        };

        let shouldReset = false;

        if (task.recurrence_type === 'daily') {
          shouldReset = true;
        } else if (task.recurrence_type === 'weekly' && task.recurrence_details) {
          shouldReset = isDayIncluded(task.recurrence_details, currentDayOfWeekInUserTimezone);
        } else if (task.recurrence_type === 'monthly' && task.recurrence_details) {
          shouldReset = task.recurrence_details === currentDayOfMonthInUserTimezone;
        }

        // Se deve resetar E a tarefa está atualmente marcada como concluída para o período anterior
        // ou se a última conclusão foi antes de hoje
        if (shouldReset && task.last_successful_completion_date) {
          const lastCompletionDate = parseISO(task.last_successful_completion_date);
          return isBefore(lastCompletionDate, startOfDay(nowInUserTimezone));
        } else if (shouldReset && !task.last_successful_completion_date) {
          return true; // Se deve resetar e nunca foi concluída, garantir que esteja como false
        }
        return false;
      });

      if (tasksToResetCompletion.length > 0) {
        const { error: resetError } = await supabase
          .from('tasks')
          .update({ 
            is_completed: false, 
            overdue: false, // Resetar status de atraso
            current_board: 'general' // Resetar para 'general' ou o board padrão para recorrentes
          })
          .in('id', tasksToResetCompletion.map(task => task.id));
        if (resetError) throw resetError;
        console.log(`[User ${userId}] Resetadas ${tasksToResetCompletion.length} tarefas recorrentes para 'is_completed: false' e 'general' board.`);
      }

      // 4. Mover tarefas de 'overdue' para 'general' se a data de vencimento for no futuro ou se for recorrente e for devida hoje
      const { data: overdueTasks, error: fetchOverdueErrorAgain } = await supabase
        .from('tasks')
        .select('id, due_date, recurrence_type, recurrence_details, current_board, parent_task_id')
        .eq('user_id', userId)
        .eq('current_board', 'overdue');

      if (fetchOverdueErrorAgain) throw fetchOverdueErrorAgain;

      const tasksToMoveFromOverdueToGeneral = overdueTasks.filter(task => {
        const isDayIncluded = (details: string | null | undefined, dayIndex: number) => {
          if (!details) return false;
          const days = details.split(',');
          const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
            "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
            "Thursday": 4, "Friday": 5, "Saturday": 6
          };
          return days.some(day => DAYS_OF_WEEK_MAP[day] === dayIndex);
        };

        // Se a tarefa tem uma data de vencimento e essa data é hoje ou no futuro
        if (task.due_date) {
          const dueDate = parseISO(task.due_date);
          if (isToday(dueDate) || isBefore(startOfDay(nowInUserTimezone), startOfDay(dueDate))) {
            return true;
          }
        }
        // Se a tarefa é recorrente e é devida hoje (ou no futuro, se aplicável)
        if (task.recurrence_type !== 'none') {
          if (task.recurrence_type === 'daily') return true;
          if (task.recurrence_type === 'weekly' && task.recurrence_details && isDayIncluded(task.recurrence_details, currentDayOfWeekInUserTimezone)) return true;
          if (task.recurrence_type === 'monthly' && task.recurrence_details === currentDayOfMonthInUserTimezone) return true;
        }
        return false;
      });

      if (tasksToMoveFromOverdueToGeneral.length > 0) {
        const { error: updateGeneralError } = await supabase
          .from('tasks')
          .update({ current_board: 'general', overdue: false }) // Mover para 'general' e remover status de atraso
          .in('id', tasksToMoveFromOverdueToGeneral.map(task => task.id));
        if (updateGeneralError) throw updateGeneralError;
        console.log(`[User ${userId}] Movidas ${tasksToMoveFromOverdueToGeneral.length} tarefas de 'overdue' para 'general'.`);
      }

      // 5. Lógica para resetar tarefas de clientes no início do mês
      // Esta lógica deve ser executada apenas no primeiro dia do mês
      if (nowInUserTimezone.getDate() === 1) {
        console.log(`[User ${userId}] Executando reset mensal para tarefas de clientes.`);

        // Mover tarefas do mês anterior para 'in_progress' ou 'completed' dependendo do status
        const { data: clientTasksToReset, error: fetchClientTasksToResetError } = await supabase
          .from('client_tasks')
          .select('id, is_completed, status')
          .eq('user_id', userId)
          .eq('month_year_reference', previousMonthYearRef); // Tarefas do mês anterior

        if (fetchClientTasksToResetError) throw fetchClientTasksToResetError;

        const updates = clientTasksToReset.map(task => {
          let newStatus = task.status;
          if (!task.is_completed) {
            // Se não foi concluída, move para 'in_progress' (ou mantém se já estiver lá)
            newStatus = 'in_progress';
          } else {
            // Se foi concluída, mantém o status final (posted, approved, etc.)
            newStatus = task.status;
          }
          return {
            id: task.id,
            status: newStatus,
            updated_at: nowUtc.toISOString(),
          };
        });

        if (updates.length > 0) {
          const { error: updateClientTasksError } = await supabase
            .from('client_tasks')
            .upsert(updates, { onConflict: 'id' }); // Usar upsert para atualizar em lote
          if (updateClientTasksError) throw updateClientTasksError;
          console.log(`[User ${userId}] Resetadas/atualizadas ${updates.length} tarefas de clientes do mês anterior.`);
        }

        // Gerar novas tarefas para o mês atual
        const { data: clients, error: fetchClientsError } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', userId);

        if (fetchClientsError) throw fetchClientsError;

        for (const client of clients || []) {
          console.log(`[User ${userId}, Client ${client.id}] Gerando tarefas para o mês atual (${currentMonthYearRef}).`);
          const { error: invokeGenerateError } = await supabase.functions.invoke('generate-client-tasks', {
            body: { clientId: client.id, monthYearRef: currentMonthYearRef, userId: userId }, // Passar userId no corpo
            headers: {
              // Remover Authorization header, pois userId está no body
            },
          });
          if (invokeGenerateError) {
            console.error(`[User ${userId}, Client ${client.id}] Erro ao invocar generate-client-tasks:`, invokeGenerateError);
          }
        }
      }
    }

    return new Response(JSON.stringify({ message: "Daily reset process completed for all users." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function daily-reset:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});