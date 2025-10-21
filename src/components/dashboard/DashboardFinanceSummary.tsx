import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { FinancialTransactionType } from '@/types/finance';
import { formatCurrency } from '@/utils/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils'; // Importando as novas funções

interface FinanceSummary {
  total_income: number;
  total_expense: number;
  balance: number;
}

const fetchFinanceSummary = async (userId: string): Promise<FinanceSummary> => {
  // Consulta otimizada para somar receitas e despesas do mês atual
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data: transactions, error } = await supabase
    .from("financial_transactions")
    .select("amount, type")
    .eq("user_id", userId)
    .gte("date", startOfMonth)
    .lte("date", endOfMonth);

  if (error) throw error;

  const total_income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const total_expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = total_income - total_expense;

  return { total_income, total_expense, balance };
};

const FinanceSummarySkeleton: React.FC = () => (
  <div className="grid gap-4 md:grid-cols-3">
    {[...Array(3)].map((_, i) => (
      <Card key={i} className="frosted-glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-5 w-5 rounded-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-3/4 mb-1" />
          <Skeleton className="h-3 w-1/3" />
        </CardContent>
      </Card>
    ))}
  </div>
);

const DashboardFinanceSummary: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: summary, isLoading, error } = useQuery<FinanceSummary, Error>({
    queryKey: ["dashboardFinanceSummary", userId],
    queryFn: () => fetchFinanceSummary(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
  });

  if (isLoading) {
    return <FinanceSummarySkeleton />;
  }

  if (error) {
    return <p className="text-red-500">Erro ao carregar resumo financeiro.</p>;
  }

  const { total_income, total_expense, balance } = summary!;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="frosted-glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Receitas do Mês</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-500">{formatCurrency(total_income)}</div>
          <p className="text-xs text-muted-foreground">Total de entradas</p>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Despesas do Mês</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-500">{formatCurrency(total_expense)}</div>
          <p className="text-xs text-muted-foreground">Total de saídas</p>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
          <DollarSign className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(balance)}
          </div>
          <p className="text-xs text-muted-foreground">Receitas - Despesas</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardFinanceSummary;