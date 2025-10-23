import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2, CalendarDays } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { FinancialTransaction } from '@/types/finance';
import { showError, showSuccess } from '@/utils/toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import TransactionForm from './TransactionForm';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils'; // Importando as novas funções

interface CompanyTransactionsListProps {
  currentPeriod: Date;
  onTransactionAdded: () => void;
}

const fetchCompanyTransactions = async (userId: string, period: Date): Promise<FinancialTransaction[]> => {
  const start = format(startOfMonth(period), "yyyy-MM-dd");
  const end = format(endOfMonth(period), "yyyy-MM-dd");

  // Otimizando o select para buscar todos os campos obrigatórios e relações leves
  const { data, error } = await supabase
    .from("financial_transactions")
    .select(`
      id, user_id, date, description, amount, type, is_recurrent_instance,
      category_id, account_id, payment_method, client_id, created_at, updated_at,
      category:financial_categories!financial_transactions_category_id_fkey(id, name, type),
      account:financial_accounts(id, name, type),
      client:clients(id, name)
    `)
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });

  if (error) throw error;
  
  // FIX TS2352: Mapear os resultados para garantir que as relações one-to-one sejam objetos únicos, não arrays.
  // O Supabase JS v2/v3 pode retornar relações one-to-one como arrays de 1 elemento se a tipagem for genérica.
  const mappedData = data?.map((t: any) => ({
    ...t,
    category: Array.isArray(t.category) ? t.category[0] : t.category,
    account: Array.isArray(t.account) ? t.account[0] : t.account,
    client: Array.isArray(t.client) ? t.client[0] : t.client,
  })) || [];

  return mappedData as FinancialTransaction[] || [];
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const renderLoading = () => (
  <div className="flex items-center justify-center p-4">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const CompanyTransactionsList: React.FC<CompanyTransactionsListProps> = ({ currentPeriod, onTransactionAdded }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | undefined>(undefined);

  const { data: transactions, isLoading: isLoadingTransactions } = useQuery<FinancialTransaction[], Error>({
    queryKey: ["companyTransactions", userId, currentPeriod.toISOString()],
    queryFn: () => fetchCompanyTransactions(userId!, currentPeriod),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
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

  const handleTransactionSaved = () => {
    onTransactionAdded();
    setIsTransactionFormOpen(false);
    setEditingTransaction(undefined);
  };

  return (
    <Card className="bg-card border border-border rounded-xl shadow-sm card-hover-effect">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-foreground">Transações de Empresa</CardTitle>
        <CardDescription className="text-muted-foreground">
          Transações para {format(currentPeriod, "MMMM yyyy")}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoadingTransactions ? renderLoading() : transactions && transactions.length > 0 ? (
          transactions.map(t => (
            <div key={t.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate">{t.description}</p>
                <p className={cn("text-sm", t.type === 'income' ? 'text-green-500' : 'text-primary')}>
                  {formatCurrency(t.amount)} ({t.category?.name || 'Sem Categoria'})
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> {formatDateTime(t.date)}
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
          <p className="text-muted-foreground">Nenhuma transação de empresa encontrada para este período.</p>
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
              onTransactionSaved={handleTransactionSaved}
              onClose={() => setIsTransactionFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default CompanyTransactionsList;