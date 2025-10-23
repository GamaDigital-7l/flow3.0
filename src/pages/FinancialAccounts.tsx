"use client";

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { FinancialAccount } from '@/types/finance';
import { showError, showSuccess } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import FinancialAccountForm from '@/components/finance/FinancialAccountForm';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const fetchFinancialAccounts = async (userId: string): Promise<FinancialAccount[]> => {
  const { data, error } = await supabase
    .from("financial_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
};

const FinancialAccounts: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | undefined>(undefined);

  const { data: accounts, isLoading, error, refetch } = useQuery<FinancialAccount[], Error>({
    queryKey: ["financialAccounts", userId],
    queryFn: () => fetchFinancialAccounts(userId!),
    enabled: !!userId,
  });

  const handleAccountSaved = () => {
    refetch();
    setIsFormOpen(false);
    setEditingAccount(undefined);
  };

  const handleEditAccount = (account: FinancialAccount) => {
    setEditingAccount(account);
    setIsFormOpen(true);
  };

  const handleDeleteAccount = useMutation({
    mutationFn: async (accountId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("financial_accounts")
        .delete()
        .eq("id", accountId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Conta deletada com sucesso!");
      refetch();
    },
    onError: (err: any) => {
      showError("Erro ao deletar conta: " + err.message);
    },
  });

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Wallet className="h-7 w-7 text-primary" /> Contas Financeiras
        </h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingAccount(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Conta
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingAccount ? "Editar Conta" : "Adicionar Nova Conta"}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Gerencie suas contas financeiras.
              </DialogDescription>
            </DialogHeader>
            <FinancialAccountForm
              initialData={editingAccount}
              onAccountSaved={handleAccountSaved}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground mb-8">
        Gerencie suas contas financeiras.
      </p>

      <Card className="bg-card border-border shadow-lg frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Contas Registradas ({accounts?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center p-4 text-primary">
              <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando contas...
            </div>
          ) : error ? (
            <p className="text-red-500">Erro ao carregar contas.</p>
          ) : accounts && accounts.length > 0 ? (
            accounts.map(account => (
              <div key={account.id} className="flex justify-between items-center p-3 border border-border rounded-lg bg-muted/20">
                <div>
                  <h3 className="font-bold text-foreground">{account.name}</h3>
                  <p className="text-sm text-muted-foreground">Tipo: {account.type}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEditAccount(account)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteAccount.mutate(account.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Nenhuma conta registrada. Adicione uma nova conta!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialAccounts;