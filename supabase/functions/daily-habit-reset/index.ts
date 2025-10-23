import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, parseISO, subDays, addDays, getDay, isBefore, isSameDay } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@3.0.1";
import { isDayEligible, calculateEligibleDays, DEFAULT_TIMEZONE } from "../lib/recurring-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Buscar todos os usuários e seus fusos horários
    const { data: users, error: fetchUsersError } = await supabase
      .from('profiles')
      .select('id, timezone');

    if (fetchUsersError) throw fetchUsersError;

    const results: { userId: string, message: string }[] = [];

    for (const user of users || []) {
      const userId = user.id;
      const userTimezone = user.timezone || DEFAULT_TIMEZONE;
      const nowUtc = new Date();
      const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
      
      const todayLocalString = format(nowInUserTimezone, "yyyy-MM-dd");
      const yesterdayLocalString = format(subDays(nowInUserTimezone, 1), "yyyy-MM-dd");
      const tomorrowLocalString = format(addDays(nowInUserTimezone, 1), "yyyy-MM-dd");

      console.log(`[User ${userId}] Executando rotina diária. Hoje (TZ): ${todayLocalString}.`);

      // 2. Buscar todos os templates de recorrência (recurrence_id = id)
      const { data: templates, error: fetchTemplatesError } = await supabase
        .from('recurring_tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('recurrence_id', supabase.rpc('get_recurrence_id', { task_id: supabase.column('id') })) // Filtra onde recurrence_id == id
        .eq('paused', false);

      if (fetchTemplatesError) {
        console.error(`[User ${userId}] Erro ao buscar templates:`, fetchTemplatesError);
        continue;
      }

      let createdCount = 0;
      let updatedCount = 0;

      for (const template of templates || []) {
        const recurrenceId = template.id;
        const { frequency, weekdays, created_at, last_completed_date_local, total_completed, fail_by_weekday, missed_days } = template;
        
        // --- A. Lógica de Criação da Instância de HOJE (se não existir) ---
        
        // 1. Verificar se HOJE é um dia elegível
        const isEligibleToday = isDayEligible(todayLocalString, frequency, weekdays);
        
        if (isEligibleToday) {
          // 2. Verificar se a instância de HOJE já existe
          const { data: existingToday, error: fetchTodayError } = await supabase
            .from('recurring_tasks')
            .select('id')
            .eq('recurrence_id', recurrenceId)
            .eq('date_local', todayLocalString)
            .single();

          if (fetchTodayError && fetchTodayError.code !== 'PGRST116') {
            console.error(`[User ${userId}] Erro ao verificar instância de HOJE:`, fetchTodayError);
            continue;
          }

          if (!existingToday) {
            // 3. Criar a instância de HOJE
            const newInstance = {
              recurrence_id: recurrenceId,
              user_id: userId,
              title: template.title,
              description: template.description,
              frequency: template.frequency,
              weekdays: template.weekdays,
              paused: false,
              completed_today: false,
              date_local: todayLocalString,
              // Copia as métricas do template para a instância de HOJE (embora as métricas só sejam relevantes no template)
              streak: template.streak,
              total_completed: template.total_completed,
              missed_days: template.missed_days,
              fail_by_weekday: template.fail_by_weekday,
              success_rate: template.success_rate,
              alert: false,
            };

            const { error: insertError } = await supabase
              .from('recurring_tasks')
              .insert(newInstance);

            if (insertError) {
              console.error(`[User ${userId}] Erro ao criar instância de HOJE para ${template.title}:`, insertError);
            } else {
              createdCount++;
            }
          }
        }

        // --- B. Lógica de Atualização de Métricas (Falha e Alerta) ---
        
        // 1. Verificar se ONTEM foi um dia elegível
        const isEligibleYesterday = isDayEligible(yesterdayLocalString, frequency, weekdays);
        
        if (isEligibleYesterday) {
          // 2. Verificar se a instância de ONTEM foi concluída
          const { data: yesterdayInstance, error: fetchYesterdayError } = await supabase
            .from('recurring_tasks')
            .select('completed_today')
            .eq('recurrence_id', recurrenceId)
            .eq('date_local', yesterdayLocalString)
            .single();

          const wasCompletedYesterday = yesterdayInstance?.completed_today === true;
          
          // 3. Se ONTEM não foi concluído, atualizar métricas de falha no TEMPLATE
          if (!wasCompletedYesterday) {
            // a. Verificar se o dia de ontem já está marcado como falha
            const yesterdayDate = parseISO(yesterdayLocalString);
            const yesterdayDayOfWeek = getDay(yesterdayDate);
            
            const yesterdayMissed = missed_days.includes(yesterdayLocalString);
            
            if (!yesterdayMissed) {
              // O dia de ontem falhou e não estava registrado. Atualizar métricas.
              
              // Recalcular Streak: Se falhou ontem, o streak é 0.
              const newStreak = 0;
              
              // Atualizar Falhas por Dia da Semana
              const newFailByWeekday = { ...fail_by_weekday };
              newFailByWeekday[yesterdayDayOfWeek] = (newFailByWeekday[yesterdayDayOfWeek] || 0) + 1;
              
              // Adicionar a missed_days
              const newMissedDays = [...missed_days, yesterdayLocalString];
              
              // Recalcular Success Rate (Total Completed / Total Eligible Days)
              const eligibleDaysSinceStart = calculateEligibleDays(
                format(parseISO(created_at), 'yyyy-MM-dd'), // Data de criação do template
                yesterdayLocalString,
                frequency,
                weekdays
              );
              
              const successRate = eligibleDaysSinceStart > 0 
                ? (total_completed / eligibleDaysSinceStart) * 100 
                : 0;

              // Atualizar o TEMPLATE (onde recurrence_id == id)
              const { error: updateTemplateError } = await supabase
                .from('recurring_tasks')
                .update({
                  streak: newStreak,
                  fail_by_weekday: newFailByWeekday,
                  missed_days: newMissedDays,
                  success_rate: successRate,
                  updated_at: nowUtc.toISOString(),
                })
                .eq('id', recurrenceId);

              if (updateTemplateError) {
                console.error(`[User ${userId}] Erro ao atualizar métricas de falha para ${template.title}:`, updateTemplateError);
              } else {
                updatedCount++;
              }
            }
          }
        }
        
        // --- C. Lógica de Alerta (Aviso de 2 dias seguidos) ---
        
        // 1. Verificar se a instância de HOJE (que acabamos de criar ou que já existia) está pendente
          const { data: todayInstance, error: fetchTodayAlertError } = await supabase
            .from('recurring_tasks')
            .select('id, completed_today')
            .eq('recurrence_id', recurrenceId)
            .eq('date_local', todayLocalString)
            .single();

          if (todayInstance && !todayInstance.completed_today) {
            // 2. Verificar se ONTEM falhou (streak = 0 no template)
            if (template.streak === 0) {
              // Se o streak é 0, significa que o hábito foi quebrado ontem.
              // Se HOJE ainda não foi concluído, ativamos o alerta na instância de HOJE.
              const { error: updateAlertError } = await supabase
                .from('recurring_tasks')
                .update({ alert: true, updated_at: nowUtc.toISOString() })
                .eq('id', todayInstance.id);
              
              if (updateAlertError) console.error(`[User ${userId}] Erro ao setar alerta para ${template.title}:`, updateAlertError);
            }
          }
      }
      
      results.push({ userId, message: `Templates processados: ${templates?.length || 0}. Instâncias criadas/atualizadas: ${createdCount + updatedCount}.` });
    }

    return new Response(
      JSON.stringify({ message: "Daily habit processing complete.", results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("Erro na Edge Function daily-habit-reset:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});