"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { formatCurrency } from '@/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { startOfMonth, endOfMonth, format, subMonths } from 'date-fns';

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  difference: number;
}

const fetchMonthlyData = async (userId: string): Promise<MonthlyData[]> => {
  const today = new Date();
  const months = Array.from({ length: 6 }, (_, i) => subMonths(today, i)); // Últimos 6 meses

  const monthlyData = await Promise.all(
    months.map(async month => {
      const start = format(startOfMonth(month), "yyyy-MM-dd");
      const end = format(endOfMonth(month), "yyyy-MM-dd");

      const { data: transactions, error: transactionsError } = await supabase
        .from("financial_transactions")
        .select("amount, type")
        .eq("user_id", userId)
        .gte("date", start)
        .lte("date", end);

      if (transactionsError) throw transactionsError;

      const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        month: format(month, "MMM", { locale: ptBR }),
        income,
        expenses,
        difference: income - expenses,
      };
    })
  );

  return monthlyData.sort((a, b) => months.indexOf(new Date(b.month)) - months.indexOf(new Date(a.month)));
};

const FinanceReport: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data, isLoading, error } = useQuery<MonthlyData[], Error>({
    queryKey: ["financeReport", userId],
    queryFn: () => fetchMonthlyData(userId!),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" /> Carregando relatório...
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500">Erro ao carregar relatório financeiro.</p>;
  }

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Relatório Mensal</CardTitle>
        <CardDescription>Diferença entre ganhos e gastos nos últimos meses.</CardDescription>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="income" name="Ganhos" fill="#34D399" />
              <Bar dataKey="expenses" name="Gastos" fill="#F87171" />
              <Bar dataKey="difference" name="Diferença" fill="#6366F1" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted-foreground">Nenhum dado financeiro encontrado.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default FinanceReport;