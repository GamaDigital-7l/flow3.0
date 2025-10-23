import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, TrendingDown, Loader2, Wallet } from 'lucide-react';
import { FinancialTransactionType } from '@/types/finance';
import { formatCurrency } from '@/utils/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils'; // Importando as novas funções

interface FinanceSummary {
  total_income: number;
  total_expense: number;
  monthly_balance: number;
  total_cash_balance: number;
}

const fetchFinanceSummary = async (userId: string): Promise<FinanceSummary> => {
  // 1. Resumo de Receitas e Despesas do Mês Atual
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data: transactions, error: transactionsError } = await supabase
    .from("financial_transactions")
    .select("amount, type")
    .eq("user_id", userId)
    .gte("date", startOfMonth)
    .lte("date", endOfMonth);

  if (transactionsError) throw transactionsError;

  const total_income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const total_expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const monthly_balance = total_income - total_expense;
  
  // 2. Saldo de Caixa Total (Soma de todas as contas)
  const { data: accounts, error: accountsError } = await supabase
    .from("financial_accounts")
    .select("current_balance")
    .eq("user_id", userId);
    
  if (accountsError) throw accountsError;
  
  const total_cash_balance = accounts.reduce((sum, account) => sum + account.current_balance, 0);


  return { total_income, total_expense, monthly_balance, total_cash_balance };
};

const FinanceSummarySkeleton: React.FC = () => (
  <div className="grid gap-4 md:grid-cols-3">
    {[...Array(3)].map((_, i) => (
      <Card key={i} className="bg-card border border-border rounded-xl shadow-sm">
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

  const { total_income, total_expense, monthly_balance, total_cash_balance } = summary!;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="bg-card border border-border rounded-xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Receitas do Mês</CardTitle>
          {/* Usando text-green-500 para receitas (feedback positivo) */}
          <TrendingUp className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-500">{formatCurrency(total_income)}</div>
          <p className="text-xs text-muted-foreground">Total de entradas</p>
        </CardContent>
      </Card>

      <Card className="bg-card border border-border rounded-xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Despesas do Mês</CardTitle>
          {/* Usando text-primary para despesas (destaque) */}
          <TrendingDown className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">{formatCurrency(total_expense)}</div>
          <p className="text-xs text-muted-foreground">Total de saídas</p>
        </CardContent>
      </Card>

      <Card className="bg-card border border-border rounded-xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Saldo de Caixa Total</CardTitle>
          <Wallet className="h-4 w-4 text-foreground" />
        </CardHeader>
        <CardContent>
          {/* Usando text-green-600 para positivo e text-primary para negativo */}
          <div className={`text-2xl font-bold ${total_cash_balance >= 0 ? 'text-green-600' : 'text-primary'}`}>
            {formatCurrency(total_cash_balance)}
          </div>
          <p className="text-xs text-muted-foreground">Soma de todas as contas</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardFinanceSummary;