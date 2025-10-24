import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { addDays } from "https://esm.sh/date-fns@3.6.0";

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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing Authorization header." }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    // Usar o client normal para verificar o usuário (não o service role, para simular o RLS)
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    
    const { data: userAuth, error: authError } = await supabaseAnon.auth.getUser();

    if (authError || !userAuth?.user) {
      console.error("Authentication error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid or expired token." }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = userAuth.user.id;
    const { clientId, monthYearRef } = await req.json();

    if (!clientId || !monthYearRef) {
      return new Response(JSON.stringify({ error: "Missing clientId or monthYearRef." }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const expiresAt = addDays(new Date(), 7).toISOString();
    const uniqueId = crypto.randomUUID();

    // Usar Service Role para inserir o link, pois a tabela public_approval_links tem RLS desabilitado
    // ou políticas que permitem inserção por qualquer um (true), mas a Edge Function deve garantir a integridade.
    const { data, error } = await supabaseServiceRole
      .from('public_approval_links')
      .insert({ client_id: clientId, user_id: userId, month_year_reference: monthYearRef, unique_id: uniqueId, expires_at: expiresAt })
      .select('unique_id')
      .single();

    if (error) {
      console.error("Error inserting link:", error);
      return new Response(JSON.stringify({ error: "Failed to generate link: " + error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ uniqueId: data.unique_id, message: "Link generated" }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});