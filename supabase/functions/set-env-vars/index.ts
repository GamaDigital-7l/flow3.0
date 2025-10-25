import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    const { telegram_bot_token, telegram_chat_id } = await req.json();

    if (telegram_bot_token === undefined || telegram_chat_id === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing telegram_bot_token or telegram_chat_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // This function doesn't actually set env variables, it just returns them
    // Edge functions don't have the ability to set env variables
    // The user will need to manually set these in the Supabase console
    return new Response(
      JSON.stringify({ message: "Please set the environment variables in the Supabase console.", telegram_bot_token, telegram_chat_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in set-env-vars:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});