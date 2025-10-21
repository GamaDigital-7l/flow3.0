"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, DollarSign, Edit, Trash2, Loader2, CalendarDays } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { FinancialBudget } from '@/types/finance';
import { showError, showSuccess } from '@/utils/toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import BudgetForm from './BudgetForm';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';

const fetchCompanyBudgets = async (userId: string): Promise<FinancialBudget[]> => {
  const { data, error } = await supabase
    .from("budgets")
    .select(`
      *,
      category:financial_categories(id, name, type)
    `)
    .eq("user_id", userId)
    .eq("scope", "company")
    .order("start_date", { ascending: false });

  if (error) throw error;
  return data || [];
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const renderLoading = () => (
  <div className="flex items-center justify-center p-4">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const CompanyBudgets: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [isBudgetFormOpen, setIsBudgetFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<FinancialBudget | undefined>(undefined);

  const { data: budgets, isLoading: isLoadingBudgets, refetch: refetchBudgets } = useQuery<FinancialBudget[], Error>({
    queryKey: ["companyBudgets", userId],
    queryFn: () => fetchCompanyBudgets(userId!),
    enabled: !!userId,
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

  const handleBudgetSaved = () => {
    refetchBudgets();
    setIsBudgetFormOpen(false);
    setEditingBudget(undefined);
  };

  return (
    <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-red-500" /> Orçamentos
        </CardTitle>
        <Dialog open={isBudgetFormOpen} onOpenChange={setIsBudgetFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingBudget(undefined)} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Orçamento
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">Adicionar Orçamento de Empresa</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Defina um limite de gastos ou meta de receita para uma categoria.
              </DialogDescription>
            </DialogHeader>
            <BudgetForm
              initialData={editingBudget}
              onBudgetSaved={handleBudgetSaved}
              onClose={() => setIsBudgetFormOpen(false)}
              defaultScope="company"
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
          <p className="text-muted-foreground">Nenhum orçamento de empresa encontrado.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyBudgets;