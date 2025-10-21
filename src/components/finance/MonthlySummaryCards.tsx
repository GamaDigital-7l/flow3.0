"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ArrowUp, ArrowDown, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthlySummaryCardsProps {
  income: number;
  expenses: number;
  result: number;
  previousMonthResult: number;
  cashBalance: number;
  projection: number;
  isLoading: boolean;
}

const MonthlySummaryCards: React.FC<MonthlySummaryCardsProps> = ({
  income,
  expenses,
  result,
  previousMonthResult,
  cashBalance,
  projection,
  isLoading,
}) => {
  const resultComparison = result - previousMonthResult;
  const isResultPositive = result >= 0;
  const isComparisonPositive = resultComparison >= 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const renderLoading = () => (
    <div className="h-6 w-24 bg-muted animate-pulse rounded-md" />
  );

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
          <DollarSign className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {isLoading ? renderLoading() : formatCurrency(income)}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
          <DollarSign className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {isLoading ? renderLoading() : formatCurrency(expenses)}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Resultado do Mês</CardTitle>
          {isResultPositive ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
        </CardHeader>
        <CardContent>
          <div className={cn("text-2xl font-bold", isResultPositive ? "text-green-500" : "text-red-500")}>
            {isLoading ? renderLoading() : formatCurrency(result)}
          </div>
          <p className="text-xs text-muted-foreground">
            {isLoading ? renderLoading() : (
              <>
                {isComparisonPositive ? <ArrowUp className="inline h-3 w-3 mr-1 text-green-500" /> : <ArrowDown className="inline h-3 w-3 mr-1 text-red-500" />}
                {formatCurrency(Math.abs(resultComparison))} vs mês anterior
              </>
            )}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Saldo de Caixa</CardTitle>
          <Wallet className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {isLoading ? renderLoading() : formatCurrency(cashBalance)}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Projeção do Mês</CardTitle>
          <TrendingUp className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            {isLoading ? renderLoading() : formatCurrency(projection)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonthlySummaryCards;