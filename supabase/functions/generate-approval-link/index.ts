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
      return new Response('Unauthorized', { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userAuth, error: authError } = await supabaseServiceRole.auth.getUser(token);

    if (authError || !userAuth.user) {
      console.error("Erro de autenticação:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or missing token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      );
    }
    const userId = userAuth.user.id;

    const { clientId, monthYearRef } = await req.json();

    if (!clientId || !monthYearRef) {
      return new Response(
        JSON.stringify({ error: "Missing clientId or monthYearRef." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Gerar um novo link
    const expiresAt = addDays(new Date(), 7); // Link válido por 7 dias
    const uniqueId = crypto.randomUUID();

    const { data: newLink, error: insertLinkError } = await supabaseServiceRole
      .from('public_approval_links')
      .insert({
        client_id: clientId,
        user_id: userId,
        month_year_reference: monthYearRef,
        unique_id: uniqueId,
        expires_at: expiresAt.toISOString(),
      })
      .select('unique_id')
      .single();

    if (insertLinkError) throw insertLinkError;

    return new Response(JSON.stringify({ uniqueId: newLink.unique_id, message: "Approval link generated successfully." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro na Edge Function generate-approval-link:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});