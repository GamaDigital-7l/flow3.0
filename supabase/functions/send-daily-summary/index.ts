import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, isBefore, startOfDay, parseISO } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@3.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: users, error: fetchUsersError } = await supabaseServiceRole
      .from('profiles')
      .select('id, timezone');

    if (fetchUsersError) throw fetchUsersError;

    for (const user of users || []) {
      const userId = user.id;
      const userTimezone = user.timezone || 'America/Sao_Paulo';

      // Fetch user-specific settings from the database
      const { data: userSettings, error: fetchSettingsError } = await supabaseServiceRole
        .from('user_settings')
        .select('telegram_bot_token, telegram_chat_id')
        .eq('user_id', userId)
        .single();

      if (fetchSettingsError) {
        console.error(`[User ${userId}] Error fetching settings:`, fetchSettingsError);
        continue;
      }

      const { telegram_bot_token, telegram_chat_id } = userSettings || {};

      const nowUtc = new Date();
      const nowInUserTimezone = utcToZonedTime(nowUtc, userTimezone);
      const todayInUserTimezoneString = format(nowInUserTimezone, "yyyy-MM-dd");

      // Fetch overdue tasks
      const { data: overdueTasks, error: overdueError } = await supabaseServiceRole
        .from('tasks')
        .select('title, due_date')
        .eq('user_id', userId)
        .eq('is_completed', false)
        .lt('due_date', todayInUserTimezoneString);

      if (overdueError) {
        console.error(`[User ${userId}] Error fetching overdue tasks:`, overdueError);
        continue;
      }

      // Fetch incomplete tasks for today
      const { data: incompleteTasks, error: incompleteError } = await supabaseServiceRole
        .from('tasks')
        .select('title, due_date')
        .eq('user_id', userId)
        .eq('is_completed', false)
        .eq('due_date', todayInUserTimezoneString);

      if (incompleteError) {
        console.error(`[User ${userId}] Error fetching incomplete tasks:`, incompleteError);
        continue;
      }

      let message = `Resumo Diário de Tarefas (${todayInUserTimezoneString}):\n`;

      if (overdueTasks.length > 0) {
        message += `\n🚨 *Tarefas Atrasadas:*\n`;
        overdueTasks.forEach(task => {
          message += `- ${task.title} (Vencimento: ${format(parseISO(task.due_date), "dd/MM/yyyy")})\n`;
        });
      }

      if (incompleteTasks.length > 0) {
        message += `\n⏳ *Tarefas Incompletas para Hoje:*\n`;
        incompleteTasks.forEach(task => {
          message += `- ${task.title}\n`;
        });
      }

      if (overdueTasks.length === 0 && incompleteTasks.length === 0) {
        message += `\n✅ Parabéns! Você está em dia com suas tarefas.`;
      }

      if (telegram_bot_token && telegram_chat_id) {
        const telegramUrl = `https://api.telegram.org/bot${telegram_bot_token}/sendMessage`;
        const telegramBody = {
          chat_id: telegram_chat_id,
          text: message,
          parse_mode: 'Markdown',
        };

        const telegramResponse = await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(telegramBody),
        });

        if (!telegramResponse.ok) {
          console.error(`[User ${userId}] Telegram API error:`, telegramResponse.status, telegramResponse.statusText, await telegramResponse.text());
        } else {
          console.log(`[User ${userId}] Telegram message sent successfully.`);
        }
      } else {
        console.warn(`[User ${userId}] Telegram secrets not configured. Skipping notification.`);
      }
    }

    return new Response(
      JSON.stringify({ message: "Daily summary sent to Telegram." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("Erro na Edge Function send-daily-summary:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});