import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, getDay, parseISO, isToday, setHours, setMinutes, isPast } from "https://esm.sh/date-fns@3.6.0";
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
      const userTimezone = user.timezone || "America/Sao_Paulo"; // Fallback timezone

      const nowUtc = new Date();
      const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
      const todayInUserTimezone = format(nowInUserTimezone, "yyyy-MM-dd", { timeZone: userTimezone });
      const currentDayOfWeekInUserTimezone = getDay(nowInUserTimezone); // 0 para domingo, 1 para segunda, etc.
      const currentDayOfMonthInUserTimezone = nowInUserTimezone.getDate().toString();

      console.log(`[User ${userId}] Executando instantiate-template-tasks para o dia: ${todayInUserTimezone} no fuso horário ${userTimezone}`);

      // 1. Buscar todas as tarefas padrão para o usuário
      const { data: templateTasks, error: fetchTemplatesError } = await supabase
        .from('template_tasks')
        .select(`
          id,
          user_id,
          title,
          description,
          recurrence_type,
          recurrence_details,
          recurrence_time,
          origin_board,
          template_task_tags (tag_id)
        `)
        .eq('user_id', userId); // Filtrar por usuário

      if (fetchTemplatesError) throw fetchTemplatesError;

      const tasksToInsert = [];
      const taskTagsToInsert = [];

      for (const template of templateTasks || []) {
        let shouldInstantiate = false;

        // Verifica se a tarefa já foi instanciada hoje para este usuário
        const { data: existingTask, error: checkExistingError } = await supabase
          .from('tasks')
          .select('id')
          .eq('user_id', template.user_id)
          .eq('title', template.title) // Uma verificação simples para evitar duplicatas
          .eq('due_date', todayInUserTimezone)
          .limit(1);

        if (checkExistingError) {
          console.error(`[User ${userId}] Erro ao verificar tarefa existente para o template ${template.id}:`, checkExistingError);
          continue;
        }
        if (existingTask && existingTask.length > 0) {
          console.log(`[User ${userId}] Tarefa "${template.title}" (template ${template.id}) já instanciada para hoje.`);
          continue; // Já existe uma tarefa para hoje, pular
        }

        const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
          "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
          "Thursday": 4, "Friday": 5, "Saturday": 6
        };

        if (template.recurrence_type === 'daily') {
          shouldInstantiate = true;
        } else if (template.recurrence_type === 'weekly' && template.recurrence_details) {
          const days = template.recurrence_details.split(',');
          shouldInstantiate = days.some(day => DAYS_OF_WEEK_MAP[day] === currentDayOfWeekInUserTimezone);
        } else if (template.recurrence_type === 'monthly' && template.recurrence_details) {
          shouldInstantiate = template.recurrence_details === currentDayOfMonthInUserTimezone;
        }

        if (shouldInstantiate) {
          const newTaskId = crypto.randomUUID(); // Gerar UUID para a nova tarefa

          tasksToInsert.push({
            id: newTaskId,
            user_id: template.user_id,
            title: template.title,
            description: template.description,
            due_date: todayInUserTimezone, // A data de vencimento é sempre hoje para tarefas instanciadas
            time: template.recurrence_time || null, // Usar recurrence_time do template
            is_completed: false,
            is_priority: template.origin_board === 'today_priority', // Definir prioridade com base no board de origem
            overdue: false, // Nova tarefa não começa como atrasada
            recurrence_type: 'none', // A tarefa instanciada não é recorrente por si só
            recurrence_details: null,
            recurrence_time: template.recurrence_time || null, // Manter o recurrence_time para notificação
            origin_board: template.origin_board,
            current_board: template.origin_board, // current_board é o mesmo que origin_board na criação
            created_at: nowUtc.toISOString(),
            updated_at: nowUtc.toISOString(),
            parent_task_id: null, // Tarefas padrão não geram subtarefas diretamente
          });

          // Coletar tags para inserção posterior
          const templateTags = template.template_task_tags.map((ttt: any) => ttt.tag_id);
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

        console.log(`[User ${userId}] Instanciadas ${tasksToInsert.length} tarefas a partir de templates.`);
      } else {
        console.log(`[User ${userId}] Nenhuma tarefa padrão para instanciar hoje.`);
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