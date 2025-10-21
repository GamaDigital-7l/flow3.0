import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/integrations/supabase/auth';
import { useQueryClient } from '@tanstack/react-query';
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

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const parseQuickEntry = (text: string) => {
    // Regex simples para tentar extrair valor e descrição
    const match = text.match(/(\d+([.,]\d{1,2})?)\s+(.*)/);
    if (match) {
      const amountStr = match[1].replace(',', '.');
      const amount = parseFloat(amountStr);
      const description = match[3].trim();
      return { amount, description };
    }
    return null;
  };

  const handleAddTransaction = async (type: 'income' | 'expense') => {
    if (input.trim() === "" || isLoading || !userId) return;

    const parsed = parseQuickEntry(input);
    if (!parsed || parsed.amount <= 0) {
      showError("Formato inválido. Use: [valor] [descrição]");
      return;
    }

    setIsLoading(true);

    try {
      const { error: insertError } = await supabase.from("financial_transactions").insert({
        user_id: userId,
        description: parsed.description,
        amount: parsed.amount,
        type: type,
        date: format(new Date(), "yyyy-MM-dd"),
        account_id: 'default_account_id', // Deve ser ajustado para a conta padrão do usuário
      });

      if (insertError) throw insertError;
      showSuccess(`Transação de ${type === 'income' ? 'Receita' : 'Despesa'} adicionada!`);

      setInput("");
      onTransactionAdded();
      queryClient.invalidateQueries({ queryKey: ["financialTransactions", userId] });
      queryClient.invalidateQueries({ queryKey: ["cashBalance", userId] });
    } catch (err: any) {
      showError("Erro ao adicionar transação: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        setIsFormOpen(true);
      } else {
        // Assume despesa por padrão para entrada rápida
        handleAddTransaction('expense');
      }
    }
  };

  const handleTransactionFormSaved = () => {
    onTransactionAdded();
    setIsFormOpen(false);
    setInput("");
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="text"
          placeholder="Adicionar transação rápida (Ex: 50.00 Aluguel)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring"
          disabled={isLoading}
        />
        <Button onClick={() => handleAddTransaction('expense')} disabled={isLoading || input.trim() === ""} className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white flex-shrink-0">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
          <span className="sr-only sm:not-sr-only sm:ml-2">Despesa</span>
        </Button>
        <Button onClick={() => handleAddTransaction('income')} disabled={isLoading || input.trim() === ""} className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white flex-shrink-0">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
          <span className="sr-only sm:not-sr-only sm:ml-2">Receita</span>
        </Button>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Adicionar Nova Transação</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Crie uma nova transação com todos os detalhes.
            </DialogDescription>
          </DialogHeader>
          <TransactionForm
            initialData={{
              description: parseQuickEntry(input)?.description || '',
              amount: parseQuickEntry(input)?.amount || 0,
              type: 'expense',
              date: new Date(),
            }}
            onTransactionSaved={handleTransactionFormSaved}
            onClose={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuickTransactionEntry;