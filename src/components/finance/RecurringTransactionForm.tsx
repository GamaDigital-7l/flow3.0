import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CalendarIcon, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RecurringTransaction, FinancialTransactionType } from '@/types/finance';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showError, showSuccess } from '@/utils/toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Checkbox } from '@/components/ui/checkbox'; // Importando Checkbox
import { convertToSaoPauloTime, convertToUtc, formatDateTime } from '@/lib/utils'; // Importando as novas funções

const RECURRENCE_OPTIONS = ['monthly', 'weekly', 'yearly', 'quarterly'] as const;
type RecurrenceType = typeof RECURRENCE_OPTIONS[number];

const recurringTransactionSchema = z.object({
  description: z.string().min(3, "Descrição deve ter pelo menos 3 caracteres."),
  amount: z.number().min(0.01, "O valor deve ser positivo."),
  type: z.enum(['income', 'expense']),
  account_id: z.string().min(1, "A conta é obrigatória."),
  category_id: z.string().optional().nullable(),
  client_id: z.string().optional().nullable(),
  recurrence_type: z.enum(RECURRENCE_OPTIONS, { required_error: "O tipo de recorrência é obrigatório." }),
  start_date: z.date({ required_error: "A data de início é obrigatória." }),
  is_active: z.boolean().default(true),
});

type RecurringTransactionFormValues = z.infer<typeof recurringTransactionSchema>;

interface RecurringTransactionFormProps {
  initialData?: Partial<RecurringTransaction>;
  onTransactionSaved: () => void;
  onClose: () => void;
}

const RecurringTransactionForm: React.FC<RecurringTransactionFormProps> = ({ initialData, onTransactionSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const { categories, accounts, clients, isLoading: isDataLoading } = useFinancialData();

  const form = useForm<RecurringTransactionFormValues>({
    resolver: zodResolver(recurringTransactionSchema),
    defaultValues: {
      description: initialData?.description || '',
      amount: initialData?.amount || 0,
      type: initialData?.type || 'expense',
      account_id: initialData?.account_id || '',
      category_id: initialData?.category_id || '',
      client_id: initialData?.client_id || '',
      recurrence_type: initialData?.recurrence_type as RecurrenceType || 'monthly',
      start_date: initialData?.start_date ? new Date(initialData.start_date) : new Date(),
      is_active: initialData?.is_active ?? true,
    },
  });

  const currentType = form.watch('type');
  const filteredCategories = categories.filter(c => c.type === currentType);

  const saveRecurringTransaction = useMutation({
    mutationFn: async (data: RecurringTransactionFormValues) => {
      if (!userId) throw new Error("Usuário não autenticado.");

      const payload = {
        ...data,
        user_id: userId,
        start_date: format(convertToUtc(data.start_date)!, 'yyyy-MM-dd'),
        category_id: data.category_id || null,
        client_id: data.client_id || null,
      };

      if (initialData?.id) {
        const { error } = await supabase.from('financial_recurrences').update(payload).eq('id', initialData.id).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_recurrences').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      showSuccess(`Recorrência ${initialData?.id ? 'atualizada' : 'adicionada'} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["recurringTransactions", userId] });
      onTransactionSaved();
    },
    onError: (error) => {
      showError("Erro ao salvar recorrência: " + error.message);
    },
  });

  const onSubmit = (data: RecurringTransactionFormValues) => {
    saveRecurringTransaction.mutate(data);
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <Textarea placeholder="Ex: Assinatura de software" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          {/* Recorrência */}
          <FormField
            control={form.control}
            name="recurrence_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Frequência</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a frequência" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Data de Início */}
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Próximo Vencimento</FormLabel>
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
        </div>

        <div className="grid grid-cols-2 gap-4">
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
                    {/* FIX: Use a non-empty string for the optional/null value */}
                    <SelectItem value="__none__">Nenhuma</SelectItem>
                    {currentCategories.map((category) => (
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
        </div>

        <div className="flex items-center space-x-2">
          <FormField
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                </FormControl>
                  <FormLabel className="text-foreground">Recorrência Ativa</FormLabel>
                  <FormDescription className="text-muted-foreground">
                    Desative para pausar a recorrência.
                  </FormDescription>
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saveRecurringTransaction.isPending}>
            {saveRecurringTransaction.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : initialData ? (
              "Salvar Alterações"
            ) : (
              "Registrar Recorrência"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default RecurringTransactionForm;