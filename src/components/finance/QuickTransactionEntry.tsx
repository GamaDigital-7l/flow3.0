"use client";

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/integrations/supabase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { FinancialTransactionType } from '@/types/finance';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import TransactionForm from './TransactionForm';
import { format } from 'date-fns';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';

interface QuickTransactionEntryProps {
  onTransactionAdded: () => void;
}

const QuickTransactionEntry: React.FC<QuickTransactionEntryProps> = ({ onTransactionAdded }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [input, setInput] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleTransactionSaved = () => {
    onTransactionAdded();
    setIsFormOpen(false);
    setInput('');
    queryClient.invalidateQueries({ queryKey: ["financialTransactions", userId] });
    queryClient.invalidateQueries({ queryKey: ["financialAccounts", userId] });
  };

  const handleOpenForm = () => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    setIsFormOpen(true);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 p-4 bg-card border border-border rounded-xl shadow-sm frosted-glass">
      <Input
        type="text"
        placeholder="Adicionar transação rápida (Ex: R$89,90 Canva)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring"
        disabled={!userId}
      />
      <Button onClick={handleOpenForm} disabled={!userId} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0">
        <PlusCircle className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only sm:ml-2">Adicionar Manualmente</span>
      </Button>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Adicionar Transação Manual</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Preencha os detalhes da transação.
            </DialogDescription>
          </DialogHeader>
          <TransactionForm
            initialData={{
              date: new Date().toISOString(),
              description: input, // Use input as default description
              amount: 0,
              type: 'expense',
              account_id: '',
              category_id: null,
              client_id: null,
              is_recurrent_instance: false,
            }}
            onTransactionSaved={handleTransactionSaved}
            onClose={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuickTransactionEntry;