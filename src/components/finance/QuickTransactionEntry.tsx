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
import { FinancialTransactionType } from '@/types/finance'; // Importando o tipo

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

  const parseQuickEntry = (text: string): { amount: number; description: string; type: FinancialTransactionType } | null => {
    const trimmedText = text.trim();
    let type: FinancialTransactionType = 'expense';
    let cleanText = trimmedText;

    // 1. Detectar Tipo
    if (trimmedText.startsWith('+')) {
      type = 'income';
      cleanText = trimmedText.substring(1).trim();
    } else if (trimmedText.startsWith('-')) {
      type = 'expense';
      cleanText = trimmedText.substring(1).trim();
    } else if (trimmedText.toLowerCase().startsWith('r$')) {
      type = 'income';
      cleanText = trimmedText.substring(2).trim();
    }

    // 2. Extrair Valor e Descrição
    // Regex para encontrar um número (com ou sem vírgula/ponto decimal) seguido por espaço e o resto da descrição
    const match = cleanText.match(/(\d+([.,]\d{1,2})?)\s+(.*)/);
    
    if (match) {
      const amountStr = match[1].replace(',', '.');
      const amount = parseFloat(amountStr);
      const description = match[3].trim();
      
      if (amount > 0) {
        return { amount, description, type };
      }
    }
    
    // Tenta um formato mais simples: apenas valor e descrição (assume expense se não detectado)
    const simpleMatch = cleanText.match(/(\d+([.,]\d{1,2})?)\s*(.*)/);
    if (simpleMatch) {
        const amountStr = simpleMatch[1].replace(',', '.');
        const amount = parseFloat(amountStr);
        const description = simpleMatch[3].trim();
        
        if (amount > 0 && description) {
            return { amount, description, type };
        }
    }

    return null;
  };

  const handleAddTransaction = async (forcedType?: FinancialTransactionType) => {
    if (input.trim() === "" || isLoading || !userId) return;

    const parsed = parseQuickEntry(input);
    
    if (!parsed || parsed.amount <= 0) {
      showError("Formato inválido. Use: [+/-][valor] [descrição] (Ex: +100.00 Venda)");
      return;
    }

    setIsLoading(true);

    try {
      const finalType = forcedType || parsed.type;
      
      const { error: insertError } = await supabase.from("financial_transactions").insert({
        user_id: userId,
        description: parsed.description,
        amount: parsed.amount,
        type: finalType,
        date: format(new Date(), "yyyy-MM-dd"),
        account_id: null,
      });

      if (insertError) throw insertError;
      showSuccess(`Transação de ${finalType === 'income' ? 'Receita' : 'Despesa'} adicionada!`);

      setInput("");
      onTransactionAdded();
      queryClient.invalidateQueries({ queryKey: ["financialTransactions", userId] });
      queryClient.invalidateQueries({ queryKey: ["cashBalance", userId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardFinanceSummary", userId] });
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
        // Se Enter for pressionado, tenta adicionar a transação com o tipo detectado
        handleAddTransaction();
      }
    }
  };

  const handleTransactionFormSaved = () => {
    onTransactionAdded();
    setIsFormOpen(false);
    setInput("");
  };
  
  const parsedData = parseQuickEntry(input);

  return (
    <>
      <div className="flex flex-col gap-2 w-full">
        <Input
          type="text"
          placeholder="Adicionar transação rápida (Ex: +100.00 Venda ou -50.00 Aluguel)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring h-11 text-base"
          disabled={isLoading}
        />
        <div className="flex gap-2 w-full flex-shrink-0">
          {/* Botão de Despesa (Padrão) */}
          <Button 
            onClick={() => handleAddTransaction('expense')} 
            disabled={isLoading || !parsedData || parsedData.amount <= 0} 
            className="flex-1 bg-red-600 hover:bg-red-700 text-white h-11 px-3 text-base"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            <span className="ml-1">Despesa</span>
          </Button>
          {/* Botão de Receita */}
          <Button 
            onClick={() => handleAddTransaction('income')} 
            disabled={isLoading || !parsedData || parsedData.amount <= 0} 
            className="flex-1 bg-green-600 hover:bg-green-700 text-white h-11 px-3 text-base"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            <span className="ml-1">Receita</span>
          </Button>
        </div>
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
              description: parsedData?.description || '',
              amount: parsedData?.amount || 0,
              type: parsedData?.type || 'expense',
              date: format(new Date(), "yyyy-MM-dd"),
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