import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, isToday } from "https://esm.sh/date-fns@2.29.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '',
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Fetch tasks for the user
    const { data: tasks, error: tasksError } = await supabaseClient
      .from('tasks')
      .select('title, is_completed, due_date')
      .eq('user_id', userId);

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      return new Response(JSON.stringify({ error: "Failed to fetch tasks" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter tasks for today
    const today = new Date();
    const todaysTasks = tasks.filter(task => task.due_date && isToday(new Date(task.due_date)));

    // Format the summary message
    let message = `Resumo Diário de Tarefas (${format(today, 'dd/MM/yyyy')}):\n`;
    todaysTasks.forEach(task => {
      message += `- ${task.title} (${task.is_completed ? 'Concluída' : 'Pendente'})\n`;
    });

    // Get Telegram config from user settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('telegram_bot_token, telegram_chat_id')
      .eq('user_id', userId)
      .single();

    if (settingsError) {
      console.error("Error fetching user settings:", settingsError);
      return new Response(JSON.stringify({ error: "Failed to fetch user settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { telegram_bot_token, telegram_chat_id } = settings;

    if (!telegram_bot_token || !telegram_chat_id) {
      console.warn("Telegram bot token or chat ID not set for user:", userId);
      return new Response(JSON.stringify({ message: "Telegram settings not configured for user." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send message to Telegram
    const telegramUrl = `https://api.telegram.org/bot${telegram_bot_token}/sendMessage`;
    const telegramBody = {
      chat_id: telegram_chat_id,
      text: message,
    };

    const resp = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telegramBody),
    });

    if (!resp.ok) {
      console.error("Error sending Telegram message:", resp.status, await resp.text());
      return new Response(JSON.stringify({ error: "Failed to send Telegram message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: "Telegram summary sent successfully." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});