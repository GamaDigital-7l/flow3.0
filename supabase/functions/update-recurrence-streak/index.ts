import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, subDays, utcToZonedTime } from "https://esm.sh/date-fns@3.6.0";

const allowedOrigins = ['http://localhost:32100', 'https://nexusflow.vercel.app'];

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };

  if (req.method === "OPTIONS") {
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
      const userTimezone = user.timezone || 'America/Sao_Paulo';

      const nowUtc = new Date();
      const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
      const yesterdayInUserTimezone = subDays(nowInUserTimezone, 1);
      const yesterdayInUserTimezoneString = format(yesterdayInUserTimezone, "yyyy-MM-dd");

      console.log(`[User ${userId}] Executando update-recurrence-streak para o dia: ${yesterdayInUserTimezoneString}`);

      // 1. Buscar todos os templates recorrentes diários
      const { data: dailyTemplates, error: fetchTemplatesError } = await supabase
        .from('tasks')
        .select('id, recurrence_streak')
        .eq('user_id', userId)
        .eq('recurrence_type', 'daily')
        .is('parent_task_id', null);

      if (fetchTemplatesError) {
        console.error(`[User ${userId}] Erro ao buscar templates diários:`, fetchTemplatesError);
        continue;
      }

      const templateUpdates = [];

      for (const template of dailyTemplates || []) {
        // 2. Verificar se a instância de ONTEM foi concluída
        const { data: yesterdayInstance, error: checkInstanceError } = await supabase
          .from('tasks')
          .select('is_completed')
          .eq('parent_task_id', template.id)
          .eq('due_date', yesterdayInUserTimezoneString)
          .limit(1)
          .single();

        if (checkInstanceError && checkInstanceError.code !== 'PGRST116') {
          console.error(`[User ${userId}] Erro ao verificar instância de ontem para template ${template.id}:`, checkInstanceError);
          continue;
        }

        let newStreak = template.recurrence_streak;
        let shouldUpdate = false;

        if (yesterdayInstance && yesterdayInstance.is_completed) {
          // Se a tarefa de ontem foi concluída, incrementa o streak
          newStreak = (template.recurrence_streak || 0) + 1;
          shouldUpdate = true;
        } else if (yesterdayInstance && !yesterdayInstance.is_completed) {
          // Se a tarefa de ontem existia e NÃO foi concluída, reseta o streak
          newStreak = 0;
          shouldUpdate = true;
        }
        // Se a instância de ontem não existia (PGRST116), não faz nada, pois a Edge Function de instanciação pode ter falhado ou o template foi criado hoje.

        if (shouldUpdate) {
          templateUpdates.push({
            id: template.id,
            recurrence_streak: newStreak,
            updated_at: nowUtc.toISOString(),
          });
        }
      }

      if (templateUpdates.length > 0) {
        const { error: updateError } = await supabase
          .from('tasks')
          .upsert(templateUpdates, { onConflict: 'id' });

        if (updateError) console.error(`[User ${userId}] Erro ao atualizar streaks:`, updateError);
        else console.log(`[User ${userId}] Atualizados ${templateUpdates.length} streaks.`);
      }
    }

    return new Response(
      JSON.stringify({ message: "Recurrence streak update complete." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("Erro na Edge Function update-recurrence-streak:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});