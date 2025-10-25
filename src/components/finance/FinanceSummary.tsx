"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { formatCurrency } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { startOfMonth, endOfMonth, format, isBefore, isAfter } from 'date-fns';

interface FinanceSummaryData {
  totalIncome: number;
  totalExpenses: number;
  netResult: number;
  projectedIncome: number;
  projectedExpenses: number;
  projectedNetResult: number;
}

const fetchFinanceSummary = async (userId: string): Promise<FinanceSummaryData> => {
  const today = new Date();
  const start = format(startOfMonth(today), "yyyy-MM-dd");
  const end = format(endOfMonth(today), "yyyy-MM-dd");

  // 1. Buscar transações dentro do período
  const { data: transactions, error: transactionsError } = await supabase
    .from("financial_transactions")
    .select("amount, type")
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end);

  if (transactionsError) throw transactionsError;

  // 2. Buscar recorrências ativas que se aplicam ao período
  const { data: recurrences, error: recurrencesError } = await supabase
    .from("financial_recurrences")
    .select("amount, type, next_due_date")
    .eq("user_id", userId)
    .eq("is_active", true)
    .lte("next_due_date", end); // Próxima data de vencimento dentro do período

  if (recurrencesError) throw recurrencesError;

  // Filtrar recorrências para incluir apenas aquelas que deveriam ter ocorrido no período
  const validRecurrences = recurrences.filter(recurrence => {
    return isAfter(new Date(recurrence.next_due_date), new Date(start));
  });

  // 3. Calcular totais
  let totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  let totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // Adicionar valores das recorrências
  totalIncome += validRecurrences
    .filter(r => r.type === 'income')
    .reduce((sum, r) => sum + r.amount, 0);

  totalExpenses += validRecurrences
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  const netResult = totalIncome - totalExpenses;

  // Previsão (simples: assume que os próximos meses serão iguais a este)
  const projectedIncome = totalIncome;
  const projectedExpenses = totalExpenses;
  const projectedNetResult = netResult;

  return {
    totalIncome,
    totalExpenses,
    netResult,
    projectedIncome,
    projectedExpenses,
    projectedNetResult,
  };
};

const FinanceSummary: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data, isLoading, error } = useQuery<FinanceSummaryData, Error>({
    queryKey: ['financeSummary', userId],
    queryFn: () => fetchFinanceSummary(userId!),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" /> Carregando resumo...
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500">Erro ao carregar resumo financeiro.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Total de Ganhos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(data.totalIncome)}</div>
        </CardContent>
      </Card>
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Total de Gastos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(data.totalExpenses)}</div>
        </CardContent>
      </Card>
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Resultado Líquido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(data.netResult)}</div>
        </CardContent>
      </Card>
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Previsão de Ganhos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(data.projectedIncome)}</div>
        </CardContent>
      </Card>
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Previsão de Gastos</CardHeader>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(data.projectedExpenses)}</div>
        </CardContent>
      </Card>
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Previsão de Resultado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(data.projectedNetResult)}</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceSummary;