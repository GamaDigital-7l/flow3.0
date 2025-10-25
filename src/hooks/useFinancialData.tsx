"use client";

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { FinancialCategory, FinancialAccount, FinancialRecurrence } from '@/types/finance';
// import { Client } from '@/types/client'; // Removido

interface FinancialData {
  categories: FinancialCategory[];
  accounts: FinancialAccount[];
  recurrences: FinancialRecurrence[];
  clients: { id: string; name: string }[]; // Tipo simplificado
  isLoading: boolean;
  error: Error | null;
}

const fetchFinancialData = async (userId: string) => {
  // Busca todas as categorias, contas e clientes do usuário, independentemente do escopo,
  // pois os formulários (como TransactionForm) precisam de todas as opções.
  const [categoriesResponse, accountsResponse, recurrencesResponse, clientsResponse] = await Promise.all([
    supabase.from("financial_categories").select("*").eq("user_id", userId).order("name", { ascending: true }),
    supabase.from("financial_accounts").select("*").eq("user_id", userId).order("name", { ascending: true }),
    supabase.from("financial_recurrences").select("*").eq("user_id", userId).order("next_due_date", { ascending: true }),
    supabase.from("clients").select("id, name").eq("user_id", userId).order("name", { ascending: true }),
  ]);

  if (categoriesResponse.error) throw categoriesResponse.error;
  if (accountsResponse.error) throw accountsResponse.error;
  if (recurrencesResponse.error) throw recurrencesResponse.error;
  if (clientsResponse.error) throw clientsResponse.error;

  return {
    categories: categoriesResponse.data || [],
    accounts: accountsResponse.data || [],
    recurrences: recurrencesResponse.data || [],
    clients: clientsResponse.data || [],
  };
};

export const useFinancialData = (): FinancialData => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["financialData", userId],
    queryFn: () => fetchFinancialData(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 60, // 60 minutes (Aumentado para dados estáticos)
  });

  return {
    categories: data?.categories || [],
    accounts: data?.accounts || [],
    recurrences: data?.recurrences || [],
    clients: data?.clients || [],
    isLoading,
    error: error as Error | null,
  };
};