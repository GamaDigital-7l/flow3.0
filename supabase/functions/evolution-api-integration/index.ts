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

    const { taskId, newStatus } = await req.json();

    if (!taskId || !newStatus) {
      return new Response(
        JSON.stringify({ error: "Missing taskId or newStatus." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Buscar detalhes da tarefa
    const { data: taskDetails, error: fetchTaskError } = await supabaseServiceRole
      .from('client_tasks')
      .select('title, description, client_id')
      .eq('id', taskId)
      .single();

    if (fetchTaskError || !taskDetails) {
      console.error("Erro ao buscar detalhes da tarefa:", fetchTaskError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch task details." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Preparar os dados para a Evolution API
    const evolutionApiData = {
      taskId: taskId,
      taskTitle: taskDetails.title,
      taskDescription: taskDetails.description,
      newStatus: newStatus,
      clientId: taskDetails.client_id,
      // Adicione outros campos conforme necessário para a Evolution API
    };

    // 3. Enviar os dados para a Evolution API
    const evolutionApiUrl = 'SUA_URL_DA_EVOLUTION_API'; // Substitua pela URL real
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY"); // Substitua pelo nome da sua env variable

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error("Evolution API URL or Key not set.");
      return new Response(
        JSON.stringify({ error: "Evolution API URL or Key not set." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    try {
      const evolutionResponse = await axios.post(evolutionApiUrl, evolutionApiData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${evolutionApiKey}`, // Se a API exigir autenticação
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

      return new Response(JSON.stringify({ message: "Data sent to Evolution API successfully." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("Erro ao enviar dados para a Evolution API:", error.message);
      return new Response(JSON.stringify({ error: "Failed to send data to Evolution API: " + error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error("Erro na Edge Function evolution-api-integration:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});