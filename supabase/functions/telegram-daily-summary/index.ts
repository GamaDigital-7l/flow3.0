import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, isToday, isBefore, startOfDay, parseISO, differenceInDays } from "https://esm.sh/date-fns@2.29.1";

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
    const { userId, timeOfDay } = await req.json();

    if (!userId || !timeOfDay) {
      return new Response(JSON.stringify({ error: "Missing userId or timeOfDay" }), {
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

    const today = new Date();
    const todayStart = startOfDay(today);
    const todayString = format(today, 'dd/MM/yyyy');

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

    // Filter tasks for today and overdue tasks
    const todaysTasks = tasks.filter(task => task.due_date && isToday(parseISO(task.due_date)));
    const overdueTasks = tasks.filter(task => task.due_date && isBefore(parseISO(task.due_date), todayStart) && !task.is_completed);

    let message = '';

    if (timeOfDay === 'morning') {
      message += `Bom dia! Resumo de tarefas para hoje, ${todayString}:\n`;
      if (todaysTasks.length > 0) {
        todaysTasks.forEach(task => {
          message += `- ${task.title} (${task.is_completed ? 'Concluída' : 'Pendente'})\n`;
        });
      } else {
        message += "Nenhuma tarefa para hoje!\n";
      }

      if (overdueTasks.length > 0) {
        message += `\nTarefas Atrasadas:\n`;
        overdueTasks.forEach(task => {
          const dueDate = parseISO(task.due_date);
          const daysOverdue = differenceInDays(today, dueDate);
          message += `- ${task.title} (Atrasada ${daysOverdue} dias)\n`;
        });
      } else {
        message += "\nNenhuma tarefa atrasada!\n";
      }
    } else if (timeOfDay === 'evening') {
      const incompleteTasks = todaysTasks.filter(task => !task.is_completed);
      message += `Boa noite! Resumo de tarefas não concluídas hoje, ${todayString}:\n`;
      if (incompleteTasks.length > 0) {
        incompleteTasks.forEach(task => {
          message += `- ${task.title}\n`;
        });
      } else {
        message += "Todas as tarefas de hoje foram concluídas!\n";
      }

      if (overdueTasks.length > 0) {
        message += `\nTarefas Atrasadas:\n`;
        overdueTasks.forEach(task => {
          const dueDate = parseISO(task.due_date);
          const daysOverdue = differenceInDays(today, dueDate);
          message += `- ${task.title} (Atrasada ${daysOverdue} dias)\n`;
        });
      } else {
        message += "\nNenhuma tarefa atrasada!\n";
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid timeOfDay parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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