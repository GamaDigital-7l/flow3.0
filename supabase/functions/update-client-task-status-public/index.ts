import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { format, parseISO } from "https://esm.sh/date-fns@3.6.0";
import { utcToZonedTime } from "https://esm.sh/date-fns-tz@3.0.1";
import { ptBR } from "https://esm.sh/date-fns@3.6.0/locale/pt-BR";

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
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { uniqueId, taskId, newStatus, editReason } = await req.json();

    if (!uniqueId || !taskId || !newStatus) {
      return new Response(
        JSON.stringify({ error: "Missing uniqueId, taskId, or newStatus." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Verificar a validade do uniqueId e obter o client_id e user_id
    const { data: approvalLink, error: fetchLinkError } = await supabaseServiceRole
      .from('public_approval_links')
      .select('client_id, user_id, expires_at, month_year_reference')
      .eq('unique_id', uniqueId)
      .gte('expires_at', new Date().toISOString()) // Link ainda válido
      .single();

    if (fetchLinkError || !approvalLink) {
      console.error("Erro ao buscar link de aprovação ou link não encontrado:", fetchLinkError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired approval link." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (new Date() > new Date(approvalLink.expires_at)) {
      return new Response(
        JSON.stringify({ error: "Approval link has expired." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { client_id, user_id, month_year_reference } = approvalLink;

    // 2. Buscar detalhes do cliente e da tarefa para o histórico
    const { data: clientDetails, error: fetchClientDetailsError } = await supabaseServiceRole
      .from('clients')
      .select('name')
      .eq('id', client_id)
      .single();

    if (fetchClientDetailsError || !clientDetails) {
      console.error("Erro ao buscar detalhes do cliente:", fetchClientDetailsError);
      throw new Error("Client details not found.");
    }

    const { data: taskDetails, error: fetchTaskDetailsError } = await supabaseServiceRole
      .from('client_tasks')
      .select('title, is_standard_task, main_task_id')
      .eq('id', taskId)
      .single();

    if (fetchTaskDetailsError || !taskDetails) {
      console.error("Erro ao buscar detalhes da tarefa:", fetchTaskDetailsError);
      throw new Error("Task details not found.");
    }

    // 3. Atualizar o status da tarefa do cliente
    const updateData: { status: string; edit_reason?: string | null; is_completed?: boolean; completed_at?: string | null; updated_at: string } = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === 'edit_requested') {
      updateData.edit_reason = editReason || null;
      updateData.is_completed = false;
      updateData.completed_at = null;
    } else if (newStatus === 'approved') {
      updateData.is_completed = true;
      updateData.completed_at = new Date().toISOString();
      updateData.edit_reason = null; // Limpar motivo de edição se aprovado
    } else if (newStatus === 'rejected') {
      updateData.is_completed = false;
      updateData.completed_at = null;
      updateData.edit_reason = editReason || null; // Usar editReason para rejeição também
    }

    const { data: updatedClientTask, error: updateTaskError } = await supabaseServiceRole
      .from('client_tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('client_id', client_id)
      .eq('user_id', user_id)
      .select('is_standard_task, main_task_id') // Re-selecionar para garantir que temos os valores mais recentes
      .single();

    if (updateTaskError || !updatedClientTask) {
      console.error("Erro ao atualizar tarefa do cliente:", updateTaskError);
      return new Response(
        JSON.stringify({ error: "Failed to update client task status." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Sincronizar com a tarefa principal se for uma tarefa padrão
    if (updatedClientTask.is_standard_task && updatedClientTask.main_task_id) {
      const mainTaskUpdateData: { is_completed?: boolean; current_board?: string; updated_at: string } = {
        updated_at: new Date().toISOString(),
      };
      
      if (newStatus === 'edit_requested' || newStatus === 'rejected') {
        // Se for rejeitada ou edição solicitada, garantimos que a tarefa principal não esteja marcada como concluída.
        mainTaskUpdateData.is_completed = false;
        mainTaskUpdateData.current_board = 'client_tasks'; // Mantém no board de clientes
      }
      
      if (Object.keys(mainTaskUpdateData).length > 1) { // Se houver algo para atualizar além de updated_at
        const { error: mainTaskError } = await supabaseServiceRole
          .from("tasks")
          .update(mainTaskUpdateData)
          .eq("id", updatedClientTask.main_task_id)
          .eq("user_id", user_id);
        if (mainTaskError) console.error("Erro ao sincronizar tarefa principal:", mainTaskError);
      }
    }

    // 5. Registrar no histórico da tarefa
    let eventType = "";
    if (newStatus === 'approved') {
      eventType = "approved_via_public_link";
    } else if (newStatus === 'edit_requested') {
      eventType = "edit_requested_via_public_link";
    } else if (newStatus === 'rejected') {
      eventType = "rejected_via_public_link";
    }

    // Obter fuso horário do usuário para registro de data/hora
    const { data: profile, error: profileError } = await supabaseServiceRole
      .from('profiles')
      .select('timezone, telegram_bot_token, telegram_chat_id') // Adicionado telegram_bot_token e telegram_chat_id
      .eq('id', user_id)
      .single();

    if (profileError) {
      console.error("Erro ao buscar perfil do usuário:", profileError);
    }

    const userTimezone = profile?.timezone || "America/Sao_Paulo";
    const nowInUserTimezone = utcToZonedTime(new Date(), userTimezone);

    if (eventType) {
      const { error: historyError } = await supabaseServiceRole
        .from('client_task_history')
        .insert({
          client_task_id: taskId,
          user_id: user_id,
          event_type: eventType,
          details: {
            client_name: clientDetails.name,
            task_title: taskDetails.title,
            month_year_reference: month_year_reference,
            edit_reason: editReason || null,
          },
          created_at: nowInUserTimezone.toISOString(),
        });
      if (historyError) {
        console.error("Erro ao registrar histórico da tarefa:", historyError);
      } else {
        console.log(`Evento de histórico registrado para a tarefa ${taskId}.`);
      }
    }
    
    // 6. Enviar notificação para o Telegram
    const TELEGRAM_BOT_TOKEN = profile?.telegram_bot_token;
    const TELEGRAM_CHAT_ID = profile?.telegram_chat_id;
    
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      let message = "";
      if (newStatus === 'approved') {
        message = `✅ Cliente ${clientDetails.name} aprovou a tarefa "${taskDetails.title}"!`;
      } else if (newStatus === 'edit_requested') {
        message = `✏️ Cliente ${clientDetails.name} solicitou edição na tarefa "${taskDetails.title}". Motivo: ${editReason}`;
      } else if (newStatus === 'rejected') {
        message = `❌ Cliente ${clientDetails.name} rejeitou a tarefa "${taskDetails.title}". Motivo: ${editReason}`;
      }
      
      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const telegramBody = {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
      };

      const resp = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telegramBody),
      });

      if (!resp.ok) {
        console.error("Erro ao enviar mensagem para o Telegram:", resp.status, await resp.text());
      }
    } else {
      console.warn("Telegram secrets não configurados. Pulando notificação.");
    }
    
    // 7. Integrar com a Evolution API
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (evolutionApiUrl && evolutionApiKey) {
      try {
        const evolutionResponse = await fetch(evolutionApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${evolutionApiKey}`,
          },
          body: JSON.stringify({
            taskId: taskId,
            taskTitle: taskDetails.title,
            taskDescription: taskDetails.description,
            newStatus: newStatus,
            clientId: client_id,
          }),
        });

        if (!evolutionResponse.ok) {
          console.error("Erro ao enviar dados para a Evolution API:", evolutionResponse.status, await evolutionResponse.text());
        } else {
          console.log("Dados enviados para a Evolution API com sucesso.");
        }
      } catch (evolutionError) {
        console.error("Erro ao chamar a Evolution API:", evolutionError);
      }
    } else {
      console.warn("Evolution API URL ou Key não configurados. Pulando integração.");
    }

    return new Response(JSON.stringify({ message: "Client task status updated successfully." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function update-client-task-status-public:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});