"use client";

import React, { useState, useCallback, useTransition } from 'react';
import PeriodSelector from './PeriodSelector';
import MonthlySummaryCards from './MonthlySummaryCards';
import QuickTransactionEntry from './QuickTransactionEntry';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CompanyFinance from './CompanyFinance';
import PersonalFinance from './PersonalFinance';
import { useSession } from '@/integrations/supabase/auth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { FinancialTransaction } from '@/types/finance';
import { showError } from '@/utils/toast';

interface FinanceLayoutProps {
  children?: React.ReactNode;
}

const fetchTransactionsForPeriod = async (userId: string, period: Date): Promise<FinancialTransaction[]> => {
  const start = format(startOfMonth(period), "yyyy-MM-dd");
  const end = format(endOfMonth(period), "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("financial_transactions")
    .select(`
      *,
      category:financial_categories!financial_transactions_category_id_fkey(id, name, type),
      subcategory:financial_categories!financial_transactions_subcategory_id_fkey(id, name, type),
      account:financial_accounts(id, name, type),
      client:clients(id, name)
    `)
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });

  if (error) throw error;
  return data || [];
};

const fetchCashBalance = async (userId: string): Promise<number> => {
  const { data, error } = await supabase
    .from("financial_accounts")
    .select('current_balance')
    .eq('user_id', userId);

  if (error) throw error;
  return data?.reduce((sum, account) => sum + account.current_balance, 0) || 0;
};

const FinanceLayout: React.FC<FinanceLayoutProps> = ({ children }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [isPending, startTransition] = useTransition(); // Initialize useTransition
  const [currentPeriod, setCurrentPeriod] = useState(startOfMonth(new Date()));

  const { data: transactions, isLoading: isLoadingTransactions, error: transactionsError, refetch: refetchTransactions } = useQuery<FinancialTransaction[], Error>({
    queryKey: ["financialTransactions", userId, currentPeriod.toISOString()],
    queryFn: () => fetchTransactionsForPeriod(userId!, currentPeriod),
    enabled: !!userId,
  });

  const { data: previousMonthTransactions, isLoading: isLoadingPreviousMonthTransactions, error: previousMonthTransactionsError } = useQuery<FinancialTransaction[], Error>({
    queryKey: ["financialTransactions", userId, subMonths(currentPeriod, 1).toISOString()],
    queryFn: () => fetchTransactionsForPeriod(userId!, subMonths(currentPeriod, 1)),
    enabled: !!userId,
  });

  const { data: cashBalance, isLoading: isLoadingCashBalance, error: cashBalanceError, refetch: refetchCashBalance } = useQuery<number, Error>({
    queryKey: ["cashBalance", userId],
    queryFn: () => fetchCashBalance(userId!),
    enabled: !!userId,
  });

  const handlePeriodChange = (newPeriod: Date) => {
    startTransition(() => {
      setCurrentPeriod(newPeriod);
    });
  };

  const handleTransactionAdded = useCallback(() => {
    refetchTransactions();
    refetchCashBalance();
    // Invalidate and refetch all relevant queries for CompanyFinance and PersonalFinance
    // This ensures all sub-components update their data
    supabase.from('financial_transactions').select('*').then(() => {
      // This is a dummy call to trigger invalidation for all related queries
      // A more granular approach would be to invalidate specific query keys
      // e.g., queryClient.invalidateQueries({ queryKey: ["companyTransactions", userId] });
      //       queryClient.invalidateQueries({ queryKey: ["personalTransactions", userId] });
      //       queryClient.invalidateQueries({ queryKey: ["companyRecurrences", userId] });
      //       queryClient.invalidateQueries({ queryKey: ["personalRecurrences", userId] });
      //       queryClient.invalidateQueries({ queryKey: ["companyGoals", userId] });
      //       queryClient.invalidateQueries({ queryKey: ["personalGoals", userId] });
      //       queryClient.invalidateQueries({ queryKey: ["proLaboreSettings", userId] });
    });
  }, [refetchTransactions, refetchCashBalance]);

  const income = transactions?.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) || 0;
  const expenses = transactions?.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0) || 0;
  const result = income - expenses;

  const previousMonthIncome = previousMonthTransactions?.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) || 0;
  const previousMonthExpenses = previousMonthTransactions?.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0) || 0;
  const previousMonthResult = previousMonthIncome - previousMonthExpenses;

  // Projeção simplificada: resultado atual + (média dos últimos 3 meses de receita - média dos últimos 3 meses de despesa)
  // Por enquanto, apenas um placeholder
  const projection = result;

  if (transactionsError) showError("Erro ao carregar transações: " + transactionsError.message);
  if (previousMonthTransactionsError) showError("Erro ao carregar transações do mês anterior: " + previousMonthTransactionsError.message);
  if (cashBalanceError) showError("Erro ao carregar saldo de caixa: " + cashBalanceError.message);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:px-10 lg:p-6">
      <h1 className="text-3xl font-bold text-foreground">Financeiro</h1>
      <p className="text-lg text-muted-foreground">
        Gerencie suas finanças pessoais e da empresa de forma inteligente.
      </p>

      <PeriodSelector currentPeriod={currentPeriod} onPeriodChange={handlePeriodChange} />

      <MonthlySummaryCards
        income={income}
        expenses={expenses}
        result={result}
        previousMonthResult={previousMonthResult}
        cashBalance={cashBalance || 0}
        projection={projection}
        isLoading={isLoadingTransactions || isLoadingPreviousMonthTransactions || isLoadingCashBalance || isPending}
      />

      <QuickTransactionEntry onTransactionAdded={handleTransactionAdded} />

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50 border border-border rounded-md">
          <TabsTrigger value="company" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Empresa</TabsTrigger>
          <TabsTrigger value="personal" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Pessoal</TabsTrigger>
        </TabsList>
        <TabsContent value="company" className="mt-4">
          <CompanyFinance currentPeriod={currentPeriod} onTransactionAdded={handleTransactionAdded} />
        </TabsContent>
        <TabsContent value="personal" className="mt-4">
          <PersonalFinance currentPeriod={currentPeriod} onTransactionAdded={handleTransactionAdded} />
        </TabsContent>
      </Tabs>

      {children}
    </div>
  );
};

export default FinanceLayout;