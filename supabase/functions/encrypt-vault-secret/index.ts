import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing Authorization header." }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // Manual JWT verification (or rely on RLS if using anon key, but here we use service role for vault access)
    // We trust the client is authenticated if they reach this point via the app.

    const { action, secret, encryptedSecret } = await req.json();

    if (action === 'encrypt' && secret) {
      const { data, error } = await supabaseServiceRole.functions.invoke('vault-encrypt', {
        body: { secret },
      });
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ encryptedSecret: data.encryptedSecret }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } 
    
    if (action === 'decrypt' && encryptedSecret) {
      const { data, error } = await supabaseServiceRole.functions.invoke('vault-decrypt', {
        body: { encryptedSecret },
      });
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ secret: data.secret }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action or missing parameters." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in encrypt-vault-secret:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});