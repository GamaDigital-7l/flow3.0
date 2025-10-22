import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FinancialTransaction, FinancialTransactionType } from '@/types/finance';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showError, showSuccess } from '@/utils/toast';
import { useFinancialData } from '@/hooks/useFinancialData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Calendar } from '@/components/ui/calendar'; // Added Calendar
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; // Added Popover components
import { CalendarIcon, Loader2, Save } from 'lucide-react';
import { cn, convertToUtc, formatDateTime, parseISO } from '@/lib/utils'; // Added cn, parseISO, utilities
import { useMutation, useQueryClient } from '@tanstack/react-query';

const transactionSchema = z.object({
  date: z.date({ required_error: "A data é obrigatória." }),
  description: z.string().min(1, "A descrição é obrigatória."),
  amount: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0.01, "O valor deve ser positivo.")
  ),
  type: z.enum(['income', 'expense']),
  category_id: z.string().nullable().optional(),
  account_id: z.string().min(1, "A conta é obrigatória."),
  payment_method: z.string().nullable().optional(),
  client_id: z.string().nullable().optional(),
  is_recurrent_instance: z.boolean().optional().default(false),
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
  initialData?: Partial<FinancialTransaction>;
  onTransactionSaved: () => void;
  onClose: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ initialData, onTransactionSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const { categories, accounts, clients, isLoading: isDataLoading } = useFinancialData();
  const queryClient = useQueryClient();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: initialData?.date ? parseISO(initialData.date) : new Date(),
      description: initialData?.description || '',
      amount: initialData?.amount || 0,
      type: initialData?.type || 'expense',
      category_id: initialData?.category_id || '',
      account_id: initialData?.account_id || '',
      payment_method: initialData?.payment_method || '',
      client_id: initialData?.client_id || '',
      is_recurrent_instance: initialData?.is_recurrent_instance || false,
    },
  });

  const currentType = form.watch('type');
  const filteredCategories = categories.filter(c => c.type === currentType);

  const saveTransactionMutation = useMutation({
    mutationFn: async (data: TransactionFormValues) => {
      if (!userId) throw new Error("Usuário não autenticado.");

      const payload = {
        ...data,
        user_id: userId,
        date: format(convertToUtc(data.date)!, 'yyyy-MM-dd'),
        category_id: data.category_id || null,
        client_id: data.client_id || null,
        payment_method: data.payment_method || null,
      };

      if (initialData?.id) {
        const { error } = await supabase.from('financial_transactions').update(payload).eq('id', initialData.id).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_transactions').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      showSuccess(`Transação ${initialData?.id ? 'atualizada' : 'adicionada'} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["financialTransactions", userId] });
      queryClient.invalidateQueries({ queryKey: ["cashBalance", userId] });
      onTransactionSaved();
    },
    onError: (error: any) => {
      showError("Erro ao salvar transação: " + error.message);
    },
  });

  const onSubmit = (data: TransactionFormValues) => {
    saveTransactionMutation.mutate(data);
  };

  if (isDataLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Tipo (Receita/Despesa) */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Valor */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor (R$)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Descrição */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Pagamento de aluguel" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          {/* Data */}
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                        {field.value ? formatDateTime(field.value, false) : <span>Selecione uma data</span>}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Conta */}
          <FormField
            control={form.control}
            name="account_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Conta</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Categoria */}
          <FormField
            control={form.control}
            name="category_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria (Opcional)</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                  value={field.value || '__none__'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma</SelectItem>
                    {filteredCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Cliente */}
          <FormField
            control={form.control}
            name="client_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente (Opcional)</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                  value={field.value || '__none__'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="payment_method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Método de Pagamento (Opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Cartão de Crédito, Pix" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saveTransactionMutation.isPending}>
            {saveTransactionMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : initialData?.id ? (
              "Salvar Alterações"
            ) : (
              "Registrar Transação"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default TransactionForm;