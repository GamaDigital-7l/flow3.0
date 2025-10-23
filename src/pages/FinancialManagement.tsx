"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@/tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { FinancialAccount, FinancialCategory } from '@/types/finance';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2, Banknote, Tag, Wallet } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import FinancialAccountForm from '@/components/finance/FinancialAccountForm';
import FinancialCategoryForm from '@/components/finance/FinancialCategoryForm';
import { cn } from '@/lib/utils';
import QuickCategoryForm from '@/components/finance/QuickCategoryForm';

const fetchAccounts = async (userId: string): Promise<FinancialAccount[]> => {
  const { data, error } = await supabase
    .from("financial_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
};

const fetchCategories = async (userId: string): Promise<FinancialCategory[]> => {
  const { data, error } = await supabase
    .from("financial_categories")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const FinancialManagement: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const { data: accounts, isLoading: isLoadingAccounts, refetch: refetchAccounts } = useQuery<FinancialAccount[], Error>({
    queryKey: ["financialAccounts", userId],
    queryFn: () => fetchAccounts(userId!),
    enabled: !!userId,
  });

  const { data: categories, isLoading: isLoadingCategories, refetch: refetchCategories } = useQuery<FinancialCategory[], Error>({
    queryKey: ["financialCategories", userId],
    queryFn: () => fetchCategories(userId!),
    enabled: !!userId,
  });

  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | undefined>(undefined);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | undefined>(undefined);
  const [isQuickCategoryFormOpen, setIsQuickCategoryFormOpen] = useState(false);

  const handleAccountSaved = () => {
    refetchAccounts();
    queryClient.invalidateQueries({ queryKey: ["financialData", userId] });
    setIsAccountFormOpen(false);
    setEditingAccount(undefined);
  };

  const handleCategorySaved = () => {
    refetchCategories();
    queryClient.invalidateQueries({ queryKey: ["financialData", userId] });
    setIsCategoryFormOpen(false);
    setEditingCategory(undefined);
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
      handleAccountSaved();
    },
    onError: (err: any) => {
      showError("Erro ao deletar conta: " + err.message);
    },
  });

  const handleDeleteCategory = useMutation({
    mutationFn: async (categoryId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("financial_categories")
        .delete()
        .eq("id", categoryId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Categoria deletada com sucesso!");
      handleCategorySaved();
    },
    onError: (err: any) => {
      showError("Erro ao deletar categoria: " + err.message);
    },
  });

  return (
    <div className="page-content-wrapper space-y-6">
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
        <Banknote className="h-7 w-7 text-primary" /> Gerenciamento Financeiro
      </h1>
      <p className="text-lg text-muted-foreground">
        Configure suas contas e categorias para um controle financeiro preciso.
      </p>

      {/* Seção de Contas */}
      <Card className="bg-card border-border shadow-lg card-hover-effect">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Wallet className="h-5 w-5 text-blue-500" /> Contas
          </CardTitle>
          <Dialog open={isAccountFormOpen} onOpenChange={setIsAccountFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingAccount(undefined)} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Conta
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">Adicionar Nova Conta</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Registre uma conta bancária, poupança ou caixa.
                </DialogDescription>
              </DialogHeader>
              <FinancialAccountForm
                initialData={editingAccount}
                onAccountSaved={handleAccountSaved}
                onClose={() => setIsAccountFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts && accounts.length > 0 ? (
            accounts.map(account => (
              <div key={account.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{account.name}</p>
                  <p className="text-sm text-muted-foreground">Saldo: {formatCurrency(account.current_balance)} | Tipo: {account.type}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingAccount(account); setIsAccountFormOpen(true); }} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteAccount.mutate(account.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Nenhuma conta registrada.</p>
          )}
        </CardContent>
      </Card>

      {/* Seção de Categorias */}
      <Card className="bg-card border-border shadow-lg card-hover-effect">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Tag className="h-5 w-5 text-green-500" /> Categorias
          </CardTitle>
          <div className="flex gap-2">
            <Dialog open={isCategoryFormOpen} onOpenChange={setIsCategoryFormOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Categoria
                </Button>
              </DialogTrigger>
              <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
                <DialogHeader>
                  <DialogTitle className="text-foreground">Adicionar Nova Categoria</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Crie categorias para organizar suas receitas e despesas.
                  </DialogDescription>
                </DialogHeader>
                <FinancialCategoryForm
                  initialData={editingCategory}
                  onCategorySaved={handleCategorySaved}
                  onClose={() => setIsCategoryFormOpen(false)}
                />
              </DialogContent>
            </Dialog>
            <Dialog open={isQuickCategoryFormOpen} onOpenChange={setIsQuickCategoryFormOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
                  <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Rápida
                </Button>
              </DialogTrigger>
              <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
                <DialogHeader>
                  <DialogTitle className="text-foreground">Adicionar Categoria Rápida</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Crie uma nova categoria rapidamente.
                  </DialogDescription>
                </DialogHeader>
                <QuickCategoryForm
                  onCategorySaved={handleCategorySaved}
                  onClose={() => setIsQuickCategoryFormOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories && categories.length > 0 ? (
            categories.map(category => (
              <div key={category.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{category.name}</p>
                  <p className={cn("text-sm", category.type === 'income' ? 'text-green-500' : 'text-red-500')}>
                    {category.type === 'income' ? 'Receita' : 'Despesa'} | Escopo: {category.scope === 'company' ? 'Empresa' : 'Pessoal'}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingCategory(category); setIsCategoryFormOpen(true); }} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory.mutate(category.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Nenhuma categoria registrada.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialManagement;