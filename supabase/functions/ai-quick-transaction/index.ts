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
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userAuth, error: authError } = await supabaseServiceRole.auth.getUser(token);

    if (authError || !userAuth.user) {
      console.error("Erro de autenticação:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or missing token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userId = userAuth.user.id;

    const { text } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Missing 'text' in request body." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch user's financial categories, accounts, and clients for better suggestions
    const { data: categories, error: categoriesError } = await supabaseServiceRole
      .from('financial_categories')
      .select('id, name, type, parent_id')
      .eq('user_id', userId);
    if (categoriesError) console.warn("Could not fetch categories:", categoriesError);

    const { data: accounts, error: accountsError } = await supabaseServiceRole
      .from('financial_accounts')
      .select('id, name, type')
      .eq('user_id', userId);
    if (accountsError) console.warn("Could not fetch accounts:", accountsError);

    const { data: clients, error: clientsError } = await supabaseServiceRole
      .from('clients')
      .select('id, name')
      .eq('user_id', userId);
    if (clientsError) console.warn("Could not fetch clients:", clientsError);

    const { data: settings, error: settingsError } = await supabaseServiceRole
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

    const categoryList = categories ? categories.map(c => `${c.name} (${c.type})`).join(', ') : 'Nenhuma categoria cadastrada.';
    const accountList = accounts ? accounts.map(a => `${a.name} (${a.type})`).join(', ') : 'Nenhuma conta cadastrada.';
    const clientList = clients ? clients.map(cl => cl.name).join(', ') : 'Nenhum cliente cadastrado.';

    const prompt = `
      Analise a seguinte entrada de texto para uma transação financeira e extraia os detalhes.
      Sugira a descrição, valor, tipo (income/expense), categoria, conta e método de pagamento.
      Se possível, vincule a um cliente existente.

      Categorias disponíveis: ${categoryList}
      Contas disponíveis: ${accountList}
      Clientes disponíveis: ${clientList}
      Métodos de pagamento comuns: Pix, Cartão de Crédito, Débito, Dinheiro, Boleto, Transferência Bancária.

      Formato de saída JSON esperado:
      {
        "description": "string",
        "amount": "number",
        "type": "income" | "expense",
        "category_id": "string | null", // ID da categoria correspondente
        "category_name": "string | null", // Nome da categoria sugerida
        "account_id": "string | null", // ID da conta correspondente
        "account_name": "string | null", // Nome da conta sugerida
        "payment_method": "string | null",
        "client_id": "string | null", // ID do cliente correspondente
        "client_name": "string | null" // Nome do cliente sugerido
      }
      Se um ID não puder ser determinado, use null.
      Se o valor não for claro, use 0.
      Se o tipo não for claro, use 'expense'.

      Entrada: "${text}"
    `;

    const chatCompletion = await aiClient.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: modelName,
      temperature: 0.2, // Mais determinístico para extração de dados
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const aiResponseContent = chatCompletion.choices[0].message.content;
    const aiSuggestion = JSON.parse(aiResponseContent);

    // Map suggested names to actual IDs
    let suggestedCategoryId = null;
    let suggestedAccountId = null;
    let suggestedClientId = null;

    if (aiSuggestion.category_name && categories) {
      const matchedCategory = categories.find(c => c.name.toLowerCase() === aiSuggestion.category_name.toLowerCase());
      if (matchedCategory) suggestedCategoryId = matchedCategory.id;
    }
    if (aiSuggestion.account_name && accounts) {
      const matchedAccount = accounts.find(a => a.name.toLowerCase() === aiSuggestion.account_name.toLowerCase());
      if (matchedAccount) suggestedAccountId = matchedAccount.id;
    }
    if (aiSuggestion.client_name && clients) {
      const matchedClient = clients.find(cl => cl.name.toLowerCase() === aiSuggestion.client_name.toLowerCase());
      if (matchedClient) suggestedClientId = matchedClient.id;
    }

    const finalSuggestion = {
      description: aiSuggestion.description,
      amount: parseFloat(aiSuggestion.amount) || 0,
      type: aiSuggestion.type,
      category_id: suggestedCategoryId,
      category_name: aiSuggestion.category_name,
      account_id: suggestedAccountId,
      account_name: aiSuggestion.account_name,
      payment_method: aiSuggestion.payment_method,
      client_id: suggestedClientId,
      client_name: aiSuggestion.client_name,
    };

    return new Response(JSON.stringify(finalSuggestion), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na Edge Function ai-quick-transaction:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});