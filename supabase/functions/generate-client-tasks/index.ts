import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, getWeek, getDay, addDays, startOfMonth, endOfMonth, isSameDay, parseISO, addDays as dateFnsAddDays } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@2.0.1"; // Importação corrigida

const allowedOrigins = ['http://localhost:32100', 'https://nexusflow.vercel.app'];

const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
  "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
  "Thursday": 4, "Friday": 5, "Saturday": 6
};

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
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userId: string;
    const { clientId, monthYearRef, userId: bodyUserId } = await req.json(); // monthYearRef: "yyyy-MM"

    if (bodyUserId) {
      userId = bodyUserId;
    } else {
      // Se não houver userId no corpo, tentar autenticar via cabeçalho (chamada do frontend)
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response('Unauthorized', { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const token = authHeader.replace('Bearer ', '');
      const { data: userAuth, error: authError } = await supabaseServiceRole.auth.getUser(token);

      if (authError || !userAuth.user) {
        console.error("Erro de autenticação:", authError);
        return new Response(
          JSON.stringify({ error: "Unauthorized: Invalid or missing token." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      userId = userAuth.user.id;
    }

    if (!clientId || !monthYearRef) {
      return new Response(
        JSON.stringify({ error: "Missing clientId or monthYearRef." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Obter o fuso horário do usuário
    const { data: profile, error: profileError } = await supabaseServiceRole
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error(`[User ${userId}] Erro ao buscar fuso horário do perfil:`, profileError);
      throw profileError;
    }
    const userTimezone = profile?.timezone || 'America/Sao_Paulo'; // Fallback

    // 1. Buscar o cliente para obter a meta mensal e o nome
    const { data: client, error: clientError } = await supabaseServiceRole
      .from('clients')
      .select('name, monthly_delivery_goal')
      .eq('id', clientId)
      .eq('user_id', userId)
      .single();

    if (clientError || !client) {
      console.error("Erro ao buscar cliente ou cliente não encontrado:", clientError);
      return new Response(
        JSON.stringify({ error: "Client not found or monthly delivery goal not set." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Buscar templates de geração de tarefas ATIVOS para o cliente
    const { data: templates, error: templatesError } = await supabaseServiceRole
      .from('client_task_generation_templates')
      .select(`
        id,
        template_name,
        description,
        delivery_count,
        generation_pattern,
        is_active,
        default_due_days,
        is_standard_task,
        client_task_tags(
          tags(id, name, color)
        )
      `)
      .eq('client_id', clientId)
      .eq('user_id', userId)
      .eq('is_active', true); // Filtrar apenas templates ativos

    if (templatesError) throw templatesError;

    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active task generation templates found for this client." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const clientTasksToInsert = [];
    const clientTaskTagsToInsert = [];
    const mainTasksToInsert = [];
    const mainTaskTagsToInsert = [];
    const nowUtc = new Date();

    // Calcular o início e fim do mês de referência no fuso horário do usuário
    const [year, month] = monthYearRef.split('-').map(Number);
    const startOfMonthInTimezone = utcToZonedTime(new Date(year, month - 1, 1), userTimezone);
    const endOfMonthInTimezone = utcToZonedTime(new Date(year, month, 0), userTimezone);

    for (const template of templates) {
      const templateTags = template.client_task_tags.map((ttt: any) => ttt.tags.id);

      for (const pattern of template.generation_pattern) {
        let currentDay = startOfMonthInTimezone;
        let tasksGeneratedForPattern = 0;

        while (currentDay <= endOfMonthInTimezone && tasksGeneratedForPattern < pattern.count) {
          const weekNumber = getWeek(currentDay, { weekStartsOn: 0 }); // Sunday is 0, Monday is 1
          const dayOfWeek = getDay(currentDay); // 0 for Sunday, 1 for Monday, etc.

          // Ajustar weekNumber para ser 1-4 dentro do mês
          const firstDayOfMonthWeek = getWeek(startOfMonthInTimezone, { weekStartsOn: 0 });
          const adjustedWeekNumber = weekNumber - firstDayOfMonthWeek + 1;

          if (adjustedWeekNumber === pattern.week && dayOfWeek === DAYS_OF_WEEK_MAP[pattern.day_of_week]) {
            const taskDueDate = template.default_due_days !== null && template.default_due_days !== undefined
              ? format(dateFnsAddDays(currentDay, template.default_due_days), "yyyy-MM-dd")
              : null;

            // Verificar se já existe uma tarefa com o mesmo título e data para evitar duplicatas
            const { data: existingClientTask, error: checkExistingClientTaskError } = await supabaseServiceRole
              .from('client_tasks')
              .select('id')
              .eq('client_id', clientId)
              .eq('user_id', userId)
              .eq('title', template.template_name) // Usar o nome do template como título padrão
              .eq('month_year_reference', monthYearRef)
              .eq('due_date', taskDueDate) // Comparar com a data de vencimento calculada
              .limit(1);

            if (checkExistingClientTaskError) {
              console.error(`Erro ao verificar tarefa existente para o cliente ${clientId}:`, checkExistingClientTaskError);
              continue;
            }

            if (existingClientTask && existingClientTask.length > 0) {
              console.log(`Tarefa "${template.template_name}" já existe para ${taskDueDate}. Pulando.`);
              tasksGeneratedForPattern++; // Contar como gerada para não exceder o limite
              currentDay = addDays(currentDay, 1); // Avançar para o próximo dia
              continue;
            }

            const newClientTaskId = crypto.randomUUID(); // Gerar um UUID para a nova tarefa do cliente
            let newMainTaskId: string | null = null;

            // Se for uma tarefa padrão, criar também no dashboard principal
            if (template.is_standard_task) { // Assumindo que template.is_standard_task existe
              newMainTaskId = crypto.randomUUID();
              mainTasksToInsert.push({
                id: newMainTaskId,
                user_id: userId,
                title: `[CLIENTE] ${template.template_name}`,
                description: `Tarefa de cliente: ${client.name}`,
                due_date: taskDueDate,
                time: null,
                recurrence_type: "none",
                recurrence_details: null,
                recurrence_time: null,
                origin_board: "client_tasks",
                current_board: "client_tasks",
                is_completed: false,
                is_priority: false,
                overdue: false,
                client_name: client.name,
                created_at: nowUtc.toISOString(),
                updated_at: nowUtc.toISOString(),
              });
              templateTags.forEach((tagId: string) => {
                mainTaskTagsToInsert.push({
                  task_id: newMainTaskId!,
                  tag_id: tagId,
                });
              });
            }

            clientTasksToInsert.push({
              id: newClientTaskId,
              client_id: clientId,
              user_id: userId,
              title: template.template_name,
              description: `Gerado a partir do template: ${template.template_name}`,
              month_year_reference: monthYearRef,
              status: 'in_progress', // Status inicial agora é 'in_production'
              due_date: taskDueDate,
              time: null,
              responsible_id: null,
              is_completed: false,
              completed_at: null,
              order_index: 0,
              created_at: nowUtc.toISOString(),
              updated_at: nowUtc.toISOString(),
              image_urls: null,
              edit_reason: null,
              is_standard_task: template.is_standard_task, // Usar o valor do template
              main_task_id: newMainTaskId, // Vincular ao ID da tarefa principal
            });

            templateTags.forEach((tagId: string) => {
              clientTaskTagsToInsert.push({
                client_task_id: newClientTaskId,
                tag_id: tagId,
              });
            });
            tasksGeneratedForPattern++;
          }
          currentDay = addDays(currentDay, 1); // Avançar para o próximo dia
        }
      }
    }

    if (clientTasksToInsert.length > 0) {
      const { error: insertClientTasksError } = await supabaseServiceRole
        .from('client_tasks')
        .insert(clientTasksToInsert);
      if (insertClientTasksError) throw insertClientTasksError;

      if (clientTaskTagsToInsert.length > 0) {
        const { error: insertClientTaskTagsError } = await supabaseServiceRole
          .from('client_task_tags')
          .insert(clientTaskTagsToInsert);
        if (insertClientTaskTagsError) throw insertClientTaskTagsError;
      }
      console.log(`[User ${userId}, Client ${clientId}] Geradas ${clientTasksToInsert.length} tarefas de cliente para ${monthYearRef}.`);
    } else {
      console.log(`[User ${userId}, Client ${clientId}] Nenhuma tarefa de cliente gerada para ${monthYearRef}.`);
    }

    if (mainTasksToInsert.length > 0) {
      const { error: insertMainTasksError } = await supabaseServiceRole
        .from('tasks')
        .insert(mainTasksToInsert);
      if (insertMainTasksError) throw insertMainTasksError;

      if (mainTaskTagsToInsert.length > 0) {
        const { error: insertMainTaskTagsError } = await supabaseServiceRole
          .from('task_tags')
          .insert(mainTaskTagsToInsert);
        if (insertMainTaskTagsError) throw insertMainTaskTagsError;
      }
      console.log(`[User ${userId}, Client ${clientId}] Geradas ${mainTasksToInsert.length} tarefas principais para ${monthYearRef}.`);
    } else {
      console.log(`[User ${userId}, Client ${clientId}] Nenhuma tarefa principal gerada para ${monthYearRef}.`);
    }

    return new Response(JSON.stringify({ message: `Generated ${clientTasksToInsert.length} client tasks and ${mainTasksToInsert.length} main tasks for ${monthYearRef}.` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function generate-client-tasks:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});