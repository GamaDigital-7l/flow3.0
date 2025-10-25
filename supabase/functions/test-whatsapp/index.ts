import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import axios from "https://esm.sh/axios@1.6.7";

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

    const { whatsappApiToken, whatsappPhoneNumberId, userId } = await req.json();

    if (!whatsappApiToken || !whatsappPhoneNumberId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing WhatsApp credentials or userId." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error("Evolution API URL or Key not set.");
      return new Response(
        JSON.stringify({ error: "Evolution API URL or Key not set." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const testMessage = "Teste de mensagem da Gama Flow!";

    const evolutionResponse = await axios.post(evolutionApiUrl, {
      phone: whatsappPhoneNumberId,
      message: testMessage,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${evolutionApiKey}`,
      },
    });

    if (evolutionResponse.status !== 200) {
      console.error("Erro na resposta da Evolution API:", evolutionResponse.status, evolutionResponse.data);
      return new Response(
        JSON.stringify({ error: "Failed to send data to Evolution API." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Dados enviados para a Evolution API com sucesso:", evolutionResponse.data);

    return new Response(JSON.stringify({ message: "Test message sent to WhatsApp successfully." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in Edge Function test-whatsapp:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});