"use client";

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { FinancialCategory, FinancialAccount } from '@/types/finance';
import { Client } from '@/types/client';

interface FinancialData {
  categories: FinancialCategory[];
  accounts: FinancialAccount[];
  clients: Partial<Client>[];
  isLoading: boolean;
  error: Error | null;
}

const fetchFinancialData = async (userId: string) => {
  // Busca todas as categorias, contas e clientes do usuário, independentemente do escopo,
  // pois os formulários (como TransactionForm) precisam de todas as opções.
  const [categoriesResponse, accountsResponse, clientsResponse] = await Promise.all([
    supabase.from("financial_categories").select("*").eq("user_id", userId).order("name", { ascending: true }),
    supabase.from("financial_accounts").select("*").eq("user_id", userId).order("name", { ascending: true }),
    supabase.from("clients").select("id, name").eq("user_id", userId).order("name", { ascending: true }),
  ]);

  if (categoriesResponse.error) throw categoriesResponse.error;
  if (accountsResponse.error) throw accountsResponse.error;
  if (clientsResponse.error) throw clientsResponse.error;

  return {
    categories: categoriesResponse.data || [],
    accounts: accountsResponse.data || [],
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
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    categories: data?.categories || [],
    accounts: data?.accounts || [],
    clients: data?.clients || [],
    isLoading,
    error: error as Error | null,
  };
};