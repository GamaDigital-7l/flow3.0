"use client";

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/integrations/supabase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { QuickTransactionSuggestion, FinancialCategory, FinancialAccount, FinancialTransactionType } from '@/types/finance';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [suggestedTransaction, setSuggestedTransaction] = useState<QuickTransactionSuggestion | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleAISuggestion = async () => {
    if (input.trim() === '' || isLoadingAI || !userId) return;

    setIsLoadingAI(true);
    setSuggestedTransaction(null); // Clear previous suggestion

    try {
      const { data, error } = await supabase.functions.invoke('ai-quick-transaction', {
        body: { text: input },
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      setSuggestedTransaction(data as QuickTransactionSuggestion);
      setIsFormOpen(true); // Open form with suggestion
    } catch (err: any) {
      showError("Erro ao obter sugestão da IA: " + err.message);
      console.error("Erro na Edge Function ai-quick-transaction:", err);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleTransactionSaved = () => {
    onTransactionAdded();
    setIsFormOpen(false);
    setSuggestedTransaction(null);
    setInput('');
    queryClient.invalidateQueries({ queryKey: ["financialTransactions", userId] });
    queryClient.invalidateQueries({ queryKey: ["financialAccounts", userId] });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 p-4 bg-card border border-border rounded-xl shadow-sm frosted-glass">
      <Input
        type="text"
        placeholder="Ex: Pix R$89,90 Canva"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && handleAISuggestion()}
        className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring"
        disabled={isLoadingAI || !userId}
      />
      <Button onClick={handleAISuggestion} disabled={isLoadingAI || input.trim() === '' || !userId} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0">
        {isLoadingAI ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        <span className="sr-only sm:not-sr-only sm:ml-2">Sugestão IA</span>
      </Button>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Confirmar Transação (Sugestão IA)</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Revise e confirme os detalhes da transação sugeridos pela IA.
            </DialogDescription>
          </DialogHeader>
          {suggestedTransaction && (
            <TransactionForm
              initialData={{
                date: new Date().toISOString(),
                description: suggestedTransaction.description,
                amount: suggestedTransaction.amount,
                type: suggestedTransaction.type,
                category_id: suggestedTransaction.category_id,
                account_id: suggestedTransaction.account_id || '',
                payment_method: suggestedTransaction.payment_method,
                client_id: suggestedTransaction.client_id,
                is_recurrent_instance: false,
              }}
              onTransactionSaved={handleTransactionSaved}
              onClose={() => setIsFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuickTransactionEntry;