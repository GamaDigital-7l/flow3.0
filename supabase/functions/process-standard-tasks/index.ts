import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, getDay, isSameDay, parseISO } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@3.0.1";

const allowedOrigins = ['http://localhost:32100', 'https://nexusflow.vercel.app'];

const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
  "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
  "Thursday": 4, "Friday": 5, "Saturday": 6
};

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

      console.log(`[User ${userId}] Executando process-standard-tasks para o dia: ${todayInUserTimezoneString} no fuso horário ${userTimezone}`);

      // 1. Buscar todos os templates de tarefas padrão ATIVOS para o usuário
      const { data: templates, error: fetchTemplatesError } = await supabase
        .from('standard_task_templates')
        .select(`
          id,
          user_id,
          title,
          description,
          recurrence_days,
          origin_board
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (fetchTemplatesError) throw fetchTemplatesError;

      const tasksToInsert = [];

      for (const template of templates || []) {
        const recurrenceDays = template.recurrence_days.split(',').map(day => DAYS_OF_WEEK_MAP[day.trim()]).filter(d => d !== undefined);
        
        if (recurrenceDays.includes(currentDayOfWeek)) {
          // É o dia de criar/reaparecer esta tarefa.

          // 2. Verificar se já existe uma instância NÃO CONCLUÍDA para este template
          // Usamos o campo 'template_task_id' na tabela 'tasks' para rastrear a origem.
          // Como estamos usando a chave de serviço, podemos consultar a tabela 'tasks' diretamente.
          const { data: existingTask, error: checkExistingError } = await supabase
            .from('tasks')
            .select('id, is_completed')
            .eq('template_task_id', template.id)
            .eq('user_id', userId)
            .eq('is_completed', false) // Procurar apenas instâncias ativas/não concluídas
            .limit(1);

          if (checkExistingError) {
            console.error(`[User ${userId}] Erro ao verificar instância existente para o template padrão ${template.id}:`, checkExistingError);
            continue;
          }

          if (existingTask && existingTask.length > 0) {
            console.log(`[User ${userId}] Instância de "${template.title}" (template padrão ${template.id}) já existe e está pendente.`);
            continue;
          }

          // 3. Se não houver instância pendente, criar uma nova.
          const newTaskId = crypto.randomUUID();

          tasksToInsert.push({
            id: newTaskId,
            user_id: template.user_id,
            title: template.title,
            description: template.description,
            due_date: todayInUserTimezoneString, // A data de vencimento é sempre hoje
            time: null,
            is_completed: false,
            is_priority: template.origin_board.includes('high_priority'), // Definir prioridade com base no board
            overdue: false,
            recurrence_type: 'none', 
            recurrence_details: null,
            recurrence_time: null,
            origin_board: template.origin_board,
            current_board: template.origin_board, // Vai direto para o board de destino
            client_name: null,
            template_task_id: template.id, // Link para o template padrão
            created_at: nowUtc.toISOString(),
            updated_at: nowUtc.toISOString(),
          });
        }
      }

      if (tasksToInsert.length > 0) {
        const { error: insertTasksError } = await supabase
          .from('tasks')
          .insert(tasksToInsert);

        if (insertTasksError) throw insertTasksError;

        console.log(`[User ${userId}] Instanciadas ${tasksToInsert.length} tarefas padrão.`);
      } else {
        console.log(`[User ${userId}] Nenhuma tarefa padrão para instanciar hoje.`);
      }
    }

    return new Response(JSON.stringify({ message: "Standard task processing completed for all users." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function process-standard-tasks:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});