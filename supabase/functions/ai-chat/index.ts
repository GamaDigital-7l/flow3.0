import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import OpenAI from "https://esm.sh/openai@4.52.2";
import Groq from "https://esm.sh/groq-sdk@0.10.0";

const allowedOrigins = [
  'http://localhost:32100',
  'http://localhost:8080',
  'https://nexusflow.vercel.app'
];

serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[2],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userAuth, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userAuth.user) {
      console.error("Erro de autenticação:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or missing token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userId = userAuth.user.id;

    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("groq_api_key, openai_api_key, ai_provider_preference")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error("Erro ao buscar configurações:", settingsError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { messages } = await req.json();

    let aiClient;
    let modelName;

    const provider = settings?.ai_provider_preference || 'groq';

    if (provider === 'groq') {
      const groqApiKey = settings?.groq_api_key || Deno.env.get("GROQ_API_KEY");
      if (!groqApiKey) {
        return new Response(
          JSON.stringify({ error: "Groq API Key not configured." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      aiClient = new Groq({ apiKey: groqApiKey });
      modelName = "llama3-8b-8192"; // Modelo padrão para Groq
    } else if (provider === 'openai') {
      const openaiApiKey = settings?.openai_api_key || Deno.env.get("OPENAI_API_KEY");
      if (!openaiApiKey) {
        return new Response(
          JSON.stringify({ error: "OpenAI API Key not configured." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      aiClient = new OpenAI({ apiKey: openaiApiKey });
      modelName = "gpt-3.5-turbo"; // Modelo padrão para OpenAI
    } else {
      return new Response(
        JSON.stringify({ error: "Provedor de IA não suportado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const chatCompletion = await aiClient.chat.completions.create({
      messages: messages,
      model: modelName,
      temperature: 0.7,
      max_tokens: 1024,
    });

    const response = chatCompletion.choices[0].message.content;

    return new Response(JSON.stringify({ response }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na Edge Function ai-chat:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});