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
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userAuth, error: authError } = await supabaseServiceRole.auth.getUser(token);

    if (authError || !userAuth?.user) {
      console.error("Authentication error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = userAuth.user.id;
    const { clientId, monthYearRef } = await req.json();

    if (!clientId || !monthYearRef) {
      return new Response(JSON.stringify({ error: "Missing data" }), { status: 400, headers: corsHeaders });
    }

    const expiresAt = addDays(new Date(), 7).toISOString();
    const uniqueId = crypto.randomUUID();

    const { data, error } = await supabaseServiceRole
      .from('public_approval_links')
      .insert({ client_id: clientId, user_id: userId, month_year_reference: monthYearRef, unique_id: uniqueId, expires_at: expiresAt })
      .select('unique_id')
      .single();

    if (error) {
      console.error("Error inserting link:", error);
      return new Response(JSON.stringify({ error: "Failed to generate link" }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ uniqueId: data.unique_id, message: "Link generated" }), { headers: corsHeaders });

  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});