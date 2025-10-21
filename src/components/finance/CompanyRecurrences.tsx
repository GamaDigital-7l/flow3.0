"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Repeat, Edit, Trash2, Loader2, Clock } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { FinancialRecurrence } from '@/types/finance';
import { showError, showSuccess } from '@/utils/toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import RecurringTransactionForm from './RecurringTransactionForm';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { cn } from '@/lib/utils';

const fetchCompanyRecurrences = async (userId: string): Promise<FinancialRecurrence[]> => {
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

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const renderLoading = () => (
  <div className="flex items-center justify-center p-4">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const CompanyRecurrences: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [isRecurrenceFormOpen, setIsRecurrenceFormOpen] = useState(false);
  const [editingRecurrence, setEditingRecurrence] = useState<FinancialRecurrence | undefined>(undefined);

  const { data: recurrences, isLoading: isLoadingRecurrences, refetch: refetchRecurrences } = useQuery<FinancialRecurrence[], Error>({
    queryKey: ["companyRecurrences", userId],
    queryFn: () => fetchCompanyRecurrences(userId!),
    enabled: !!userId,
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

  const handleRecurrenceSaved = () => {
    refetchRecurrences();
    setIsRecurrenceFormOpen(false);
    setEditingRecurrence(undefined);
  };

  return (
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
            <RecurringTransactionForm
              initialData={editingRecurrence}
              onTransactionSaved={handleRecurrenceSaved}
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
          <p className="text-muted-foreground">Nenhuma transação recorrente de empresa encontrada.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyRecurrences;