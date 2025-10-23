import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, getDay, parseISO, isToday, setHours, setMinutes, isPast, startOfDay, isSameDay, addDays } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@3.0.1";

const allowedOrigins = ['http://localhost:32100', 'https://nexusflow.vercel.app'];

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
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

    const { data: users, error: fetchUsersError } = await supabase
      .from('profiles')
      .select('id, timezone');

    if (fetchUsersError) throw fetchUsersError;

    for (const user of users || []) {
      const userId = user.id;
      const userTimezone = user.timezone || "America/Sao_Paulo";
      const nowUtc = new Date();
      const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
      const todayInUserTimezoneString = format(nowInUserTimezone, "yyyy-MM-dd");
      const currentDayOfWeek = getDay(nowInUserTimezone); // 0=Dom, 1=Seg...
      const currentDayOfMonth = nowInUserTimezone.getDate().toString();

      console.log(`[User ${userId}] Executando instantiate-template-tasks para o dia: ${todayInUserTimezoneString} no fuso horário ${userTimezone}`);

      // 1. Buscar todos os templates de recorrência ATIVOS para o usuário
      const { data: templateTasks, error: fetchTemplatesError } = await supabase
        .from('tasks')
        .select(`
          id,
          user_id,
          title,
          description,
          recurrence_type,
          recurrence_details,
          recurrence_time,
          origin_board,
          is_priority,
          client_name,
          recurrence_streak,
          task_tags (tag_id)
        `)
        .eq('user_id', userId)
        .neq('recurrence_type', 'none')
        .is('parent_task_id', null); // Apenas templates (tarefas que não são instâncias)

      if (fetchTemplatesError) throw fetchTemplatesError;

      const tasksToInsert = [];
      const taskTagsToInsert = [];

      for (const template of templateTasks || []) {
        let shouldInstantiate = false;

        // Lógica de recorrência
        if (template.recurrence_type === 'daily') {
          shouldInstantiate = true;
        } else if (template.recurrence_type === 'weekly' && template.recurrence_details) {
          // Detalhes são strings de dias da semana separados por vírgula (ex: "Monday,Wednesday")
          const days = template.recurrence_details.split(',').map(day => {
            // Mapeamento de string de dia (Monday, Tuesday) para número (1, 2)
            const dayMap: { [key: string]: number } = {
              "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
              "Thursday": 4, "Friday": 5, "Saturday": 6
            };
            return dayMap[day];
          }).filter(n => n !== undefined);
          
          shouldInstantiate = days.includes(currentDayOfWeek);
        } else if (template.recurrence_type === 'monthly' && template.recurrence_details) {
          shouldInstantiate = template.recurrence_details === currentDayOfMonth;
        }

        if (shouldInstantiate) {
          // 2. Verificar se a instância já existe para HOJE
          const { data: existingInstance, error: checkExistingError } = await supabase
            .from('tasks')
            .select('id')
            .eq('parent_task_id', template.id) // Instâncias usam o ID do template como parent_task_id
            .eq('due_date', todayInUserTimezoneString)
            .limit(1);

          if (checkExistingError) {
            console.error(`[User ${userId}] Erro ao verificar instância existente para o template ${template.id}:`, checkExistingError);
            continue;
          }
          if (existingInstance && existingInstance.length > 0) {
            console.log(`[User ${userId}] Instância de "${template.title}" (template ${template.id}) já existe para hoje. Pulando.`);
            continue;
          }

          // 3. Criar a nova instância
          const newTaskId = crypto.randomUUID();

          tasksToInsert.push({
            id: newTaskId,
            user_id: template.user_id,
            title: template.title,
            description: template.description,
            due_date: todayInUserTimezoneString, // A data de vencimento é sempre hoje
            time: template.recurrence_time || null,
            is_completed: false,
            is_priority: template.is_priority,
            overdue: false,
            recurrence_type: 'none', // A instância não é recorrente
            recurrence_details: null,
            recurrence_time: template.recurrence_time || null,
            origin_board: template.origin_board,
            current_board: 'recurring', // Todas as instâncias vão para o quadro 'recurring'
            client_name: template.client_name,
            parent_task_id: template.id, // Link para o template (usando parent_task_id para instâncias)
            // O recurrence_streak da instância é o mesmo do template pai no momento da criação
            recurrence_streak: template.recurrence_streak || 0, 
            created_at: nowUtc.toISOString(),
            updated_at: nowUtc.toISOString(),
          });

          // Coletar tags
          const templateTags = template.task_tags.map((ttt: any) => ttt.tag_id);
          templateTags.forEach((tagId: string) => {
            taskTagsToInsert.push({
              task_id: newTaskId,
              tag_id: tagId,
            });
          });
        }
      }

      if (tasksToInsert.length > 0) {
        const { error: insertTasksError } = await supabase
          .from('tasks')
          .insert(tasksToInsert);

        if (insertTasksError) throw insertTasksError;

        if (taskTagsToInsert.length > 0) {
          const { error: insertTaskTagsError } = await supabase
            .from('task_tags')
            .insert(taskTagsToInsert);
          if (insertTaskTagsError) throw insertTaskTagsError;
        }

        console.log(`[User ${userId}] Instanciadas ${tasksToInsert.length} tarefas recorrentes.`);
      } else {
        console.log(`[User ${userId}] Nenhuma tarefa recorrente para instanciar hoje.`);
      }
    }

    return new Response(JSON.stringify({ message: "Template tasks instantiation process completed for all users." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function instantiate-template-tasks:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});