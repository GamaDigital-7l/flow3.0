"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, TrendingUp, Edit, Trash2, Loader2, CalendarDays } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { FinancialGoal } from '@/types/finance';
import { showError, showSuccess } from '@/utils/toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import FinancialGoalForm from './FinancialGoalForm';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';

const fetchCompanyGoals = async (userId: string): Promise<FinancialGoal[]> => {
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

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const renderLoading = () => (
  <div className="flex items-center justify-center p-4">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const CompanyGoals: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | undefined>(undefined);

  const { data: goals, isLoading: isLoadingGoals, refetch: refetchGoals } = useQuery<FinancialGoal[], Error>({
    queryKey: ["companyGoals", userId],
    queryFn: () => fetchCompanyGoals(userId!),
    enabled: !!userId,
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

  const handleGoalSaved = () => {
    refetchGoals();
    setIsGoalFormOpen(false);
    setEditingGoal(undefined);
  };

  return (
    <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" /> Metas Financeiras
        </CardTitle>
        <Dialog open={isGoalFormOpen} onOpenChange={setIsGoalFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingGoal(undefined)} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Meta
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">Adicionar Meta Financeira</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Defina uma meta de poupança ou investimento.
              </DialogDescription>
            </DialogHeader>
            <FinancialGoalForm
              initialData={editingGoal}
              onGoalSaved={handleGoalSaved}
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
                    <CalendarDays className="h-3 w-3" /> Data Alvo: {format(new Date(goal.target_date), "PPP")} {/* FIX TS2554 */}
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
          <p className="text-muted-foreground">Nenhuma meta financeira de empresa encontrada.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyGoals;