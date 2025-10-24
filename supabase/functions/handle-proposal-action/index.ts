import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NOTE: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set as Supabase Secrets
// The user needs to set these secrets manually in the Supabase Console.

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { proposalId, status, userId, totalAmount, clientName, editReason } = await req.json();

    if (!proposalId || !status || !userId || !clientName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    
    let message = "";
    let statusText = "";

    if (status === 'accepted') {
      statusText = "ACEITA";
      message = `✅ PROPOSTA ACEITA! Cliente: ${clientName}. Valor: R$ ${totalAmount.toFixed(2)}. ID: ${proposalId.substring(0, 8)}.`;
      
      // 1. Integração Financeira: Criar Transação de Receita
      const { error: financeError } = await supabaseServiceRole
        .from("financial_transactions")
        .insert({
          user_id: userId,
          description: `Receita - Proposta Aceita: ${clientName}`,
          amount: totalAmount,
          type: 'income',
          date: new Date().toISOString().split('T')[0],
          is_recurrent_instance: false,
          // account_id e category_id são deixados como NULL, pois não temos a informação aqui.
        });

      if (financeError) {
        console.error("Erro ao criar transação financeira:", financeError);
      }
      
    } else if (status === 'rejected') {
      statusText = "REJEITADA";
      message = `❌ PROPOSTA REJEITADA. Cliente: ${clientName}. ID: ${proposalId.substring(0, 8)}.`;
    } else if (status === 'edit_requested') {
      statusText = "EDIÇÃO SOLICITADA";
      message = `✏️ EDIÇÃO SOLICITADA na proposta ${proposalId.substring(0, 8)} pelo cliente ${clientName}. Motivo: ${editReason}`;
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid status for action." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Notificação Telegram
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
        }),
      });
    } else {
      console.warn("Telegram secrets not configured. Skipping notification.");
    }

    // 3. Update proposal status
    const { error: updateError } = await supabaseServiceRole
      .from('proposals')
      .update({ status: status, updated_at: new Date().toISOString() })
      .eq('id', proposalId);

    if (updateError) {
      console.error("Erro ao atualizar status da proposta:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update proposal status." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: `Proposal ${statusText} handled successfully.` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function handle-proposal-action:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});