"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, DollarSign, Clock, CalendarDays, TrendingUp, TrendingDown, Edit, Trash2, AlertCircle, Heart, Repeat, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { FinancialTransaction, FinancialRecurrence, FinancialBudget, FinancialGoal } from '@/types/finance';
import { showError, showSuccess } from '@/utils/toast';
import { format, isPast, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import TransactionForm from './TransactionForm';
import RecurrenceForm from './RecurrenceForm';
import BudgetForm from './BudgetForm';
import FinancialGoalForm from './FinancialGoalForm';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface PersonalFinanceProps {
  currentPeriod: Date;
  onTransactionAdded: () => void;
}

const fetchPersonalTransactions = async (userId: string, period: Date): Promise<FinancialTransaction[]> => {
  const start = format(startOfMonth(period), "yyyy-MM-dd");
  const end = format(endOfMonth(period), "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("financial_transactions")
    .select(`
      *,
      category:financial_categories!financial_transactions_category_id_fkey(id, name, type),
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

const fetchPersonalRecurrences = async (userId: string): Promise<FinancialRecurrence[]> => {
  const { data, error } = await supabase
    .from("financial_recurrences")
    .select(`
      *,
      category:financial_categories(id, name, type),
      account:financial_accounts(id, name, type)
    `)
    .eq("user_id", userId)
    .order("next_due_date", { ascending: true });

  if (error) throw error;
  return data || [];
};

const fetchPersonalBudgets = async (userId: string): Promise<FinancialBudget[]> => {
  const { data, error } = await supabase
    .from("budgets")
    .select(`
      *,
      category:financial_categories(id, name, type)
    `)
    .eq("user_id", userId)
    .eq("scope", "personal")
    .order("start_date", { ascending: false });

  if (error) throw error;
  return data || [];
};

const fetchPersonalGoals = async (userId: string): Promise<FinancialGoal[]> => {
  const { data, error } = await supabase
    .from("financial_goals")
    .select(`
      *,
      linked_account:financial_accounts(id, name, type)
    `)
    .eq("user_id", userId)
    .order("target_date", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data || [];
};

const PersonalFinance: React.FC<PersonalFinanceProps> = ({ currentPeriod, onTransactionAdded }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | undefined>(undefined);
  const [isRecurrenceFormOpen, setIsRecurrenceFormOpen] = useState(false);
  const [editingRecurrence, setEditingRecurrence] = useState<FinancialRecurrence | undefined>(undefined);
  const [isBudgetFormOpen, setIsBudgetFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<FinancialBudget | undefined>(undefined);
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | undefined>(undefined);

  const { data: transactions, isLoading: isLoadingTransactions, error: transactionsError, refetch: refetchTransactions } = useQuery<FinancialTransaction[], Error>({
    queryKey: ["personalTransactions", userId, currentPeriod.toISOString()],
    queryFn: () => fetchPersonalTransactions(userId!, currentPeriod),
    enabled: !!userId,
  });

  const { data: recurrences, isLoading: isLoadingRecurrences, error: recurrencesError, refetch: refetchRecurrences } = useQuery<FinancialRecurrence[], Error>({
    queryKey: ["personalRecurrences", userId],
    queryFn: () => fetchPersonalRecurrences(userId!),
    enabled: !!userId,
  });

  const { data: budgets, isLoading: isLoadingBudgets, error: budgetsError, refetch: refetchBudgets } = useQuery<FinancialBudget[], Error>({
    queryKey: ["personalBudgets", userId],
    queryFn: () => fetchPersonalBudgets(userId!),
    enabled: !!userId,
  });

  const { data: goals, isLoading: isLoadingGoals, error: goalsError, refetch: refetchGoals } = useQuery<FinancialGoal[], Error>({
    queryKey: ["personalGoals", userId],
    queryFn: () => fetchPersonalGoals(userId!),
    enabled: !!userId,
  });

  const handleEditTransaction = (transaction: FinancialTransaction) => {
    setEditingTransaction(transaction);
    setIsTransactionFormOpen(true);
  };

  const handleDeleteTransaction = useMutation({
    mutationFn: async (transactionId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("financial_transactions")
        .delete()
        .eq("id", transactionId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Transação deletada com sucesso!");
      onTransactionAdded(); // Refetch transactions and balance
    },
    onError: (err: any) => {
      showError("Erro ao deletar transação: " + err.message);
    },
  });

  const handleEditRecurrence = (rec: FinancialRecurrence) => {
    setEditingRecurrence(rec);
    setIsRecurrenceFormOpen(true);
  };

  const handleDeleteRecurrence = useMutation({
    mutationFn: async (recId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("financial_recurrences")
        .delete()
        .eq("id", recId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Recorrência deletada com sucesso!");
      refetchRecurrences();
    },
    onError: (err: any) => {
      showError("Erro ao deletar recorrência: " + err.message);
    },
  });

  const handleEditBudget = (budget: FinancialBudget) => {
    setEditingBudget(budget);
    setIsBudgetFormOpen(true);
  };

  const handleDeleteBudget = useMutation({
    mutationFn: async (budgetId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("budgets")
        .delete()
        .eq("id", budgetId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Orçamento deletado com sucesso!");
      refetchBudgets();
    },
    onError: (err: any) => {
      showError("Erro ao deletar orçamento: " + err.message);
    },
  });

  const handleEditGoal = (goal: FinancialGoal) => {
    setEditingGoal(goal);
    setIsGoalFormOpen(true);
  };

  const handleDeleteGoal = useMutation({
    mutationFn: async (goalId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("financial_goals")
        .delete()
        .eq("id", goalId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Meta deletada com sucesso!");
      refetchGoals();
    },
    onError: (err: any) => {
      showError("Erro ao deletar meta: " + err.message);
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const renderLoading = () => (
    <div className="flex items-center justify-center p-4">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Goals */}
      <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" /> Metas Pessoais
          </CardTitle>
          <Dialog open={isGoalFormOpen} onOpenChange={setIsGoalFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingGoal(undefined)} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Meta
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">Adicionar Meta Financeira Pessoal</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Defina uma meta de poupança ou investimento pessoal.
                </DialogDescription>
              </DialogHeader>
              <FinancialGoalForm
                initialData={editingGoal}
                onGoalSaved={refetchGoals}
                onClose={() => setIsGoalFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingGoals ? renderLoading() : goals && goals.length > 0 ? (
            goals.map(goal => (
              <div key={goal.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{goal.name}</p>
                  <p className="text-sm text-muted-foreground">Alvo: {formatCurrency(goal.target_amount)} | Atual: {formatCurrency(goal.current_amount)}</p>
                  {goal.target_date && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> Data Alvo: {format(new Date(goal.target_date), "PPP", { locale: ptBR })}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleEditGoal(goal)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteGoal.mutate(goal.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Nenhuma meta financeira pessoal encontrada.</p>
          )}
        </CardContent>
      </Card>

      {/* Budgets */}
      <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-red-500" /> Orçamentos Pessoais
          </CardTitle>
          <Dialog open={isBudgetFormOpen} onOpenChange={setIsBudgetFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingBudget(undefined)} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Orçamento
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">Adicionar Orçamento Pessoal</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Defina um limite de gastos ou meta de receita para uma categoria.
                </DialogDescription>
              </DialogHeader>
              <BudgetForm
                initialData={editingBudget}
                onBudgetSaved={refetchBudgets}
                onClose={() => setIsBudgetFormOpen(false)}
                defaultScope="personal"
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingBudgets ? renderLoading() : budgets && budgets.length > 0 ? (
            budgets.map(budget => (
              <div key={budget.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{budget.name}</p>
                  <p className="text-sm text-muted-foreground">Valor: {formatCurrency(budget.amount)} | Tipo: {budget.type === 'income' ? 'Receita' : 'Despesa'}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" /> Período: {format(new Date(budget.start_date), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(budget.end_date), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleEditBudget(budget)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteBudget.mutate(budget.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Nenhum orçamento pessoal encontrado.</p>
          )}
        </CardContent>
      </Card>

      {/* Recurrences */}
      <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Repeat className="h-5 w-5 text-orange-500" /> Transações Recorrentes
          </CardTitle>
          <Dialog open={isRecurrenceFormOpen} onOpenChange={setIsRecurrenceFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingRecurrence(undefined)} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Recorrência
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">Adicionar Recorrência</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Crie uma transação que se repete automaticamente.
                </DialogDescription>
              </DialogHeader>
              <RecurrenceForm
                initialData={editingRecurrence}
                onRecurrenceSaved={refetchRecurrences}
                onClose={() => setIsRecurrenceFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingRecurrences ? renderLoading() : recurrences && recurrences.length > 0 ? (
            recurrences.map(rec => (
              <div key={rec.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{rec.description}</p>
                  <p className={cn("text-sm", rec.type === 'income' ? 'text-green-500' : 'text-red-500')}>
                    {formatCurrency(rec.amount)} ({rec.frequency})
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Próximo Vencimento: {format(new Date(rec.next_due_date), "PPP", { locale: ptBR })}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleEditRecurrence(rec)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteRecurrence.mutate(rec.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Nenhuma transação recorrente pessoal encontrada.</p>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Transações Pessoais</CardTitle>
          <CardDescription className="text-muted-foreground">
            Transações para {format(currentPeriod, "MMMM yyyy", { locale: ptBR })}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingTransactions ? renderLoading() : transactions && transactions.length > 0 ? (
            transactions.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{t.description}</p>
                  <p className={cn("text-sm", t.type === 'income' ? 'text-green-500' : 'text-red-500')}>
                    {formatCurrency(t.amount)} ({t.category?.name || 'Sem Categoria'})
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" /> {format(new Date(t.date), "PPP", { locale: ptBR })}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleEditTransaction(t)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteTransaction.mutate(t.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Nenhuma transação pessoal encontrada para este período.</p>
          )}
          <Dialog open={isTransactionFormOpen} onOpenChange={setIsTransactionFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingTransaction(undefined)} variant="outline" className="w-full border-dashed border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Transação Manual
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">Adicionar Transação</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Registre uma nova transação financeira.
                </DialogDescription>
              </DialogHeader>
              <TransactionForm
                initialData={editingTransaction}
                onTransactionSaved={onTransactionAdded}
                onClose={() => setIsTransactionFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonalFinance;