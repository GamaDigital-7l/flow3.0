import React, { useState } from 'react';
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
import { FinancialBudget, FinancialScope, FinancialTransactionType } from '@/types/finance';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showError, showSuccess } from '@/utils/toast';
import { useFinancialData } from '@/hooks/useFinancialData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn, convertToSaoPauloTime, convertToUtc, formatDateTime, parseISO } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const budgetSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório."),
  amount: z.number().min(0.01, "O valor deve ser positivo."),
  type: z.enum(['income', 'expense']),
  start_date: z.date({ required_error: "A data de início é obrigatória." }),
  end_date: z.date({ required_error: "A data de fim é obrigatória." }),
  category_id: z.string().nullable().optional(),
  scope: z.enum(['company', 'personal']),
});

type BudgetFormValues = z.infer<typeof budgetSchema>;

interface BudgetFormProps {
  initialData?: FinancialBudget | null;
  onBudgetSaved: () => void;
  onClose: () => void;
  defaultScope: FinancialScope;
}

const BudgetForm: React.FC<BudgetFormProps> = ({ initialData, onBudgetSaved, onClose, defaultScope }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const { categories, isLoading: isDataLoading } = useFinancialData();
  const queryClient = useQueryClient();

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      name: initialData?.name || '',
      amount: initialData?.amount || 0,
      type: initialData?.type || 'expense',
      start_date: initialData?.start_date ? parseISO(initialData.start_date) : new Date(),
      end_date: initialData?.end_date ? parseISO(initialData.end_date) : new Date(),
      category_id: initialData?.category_id || '',
      scope: initialData?.scope || defaultScope,
    },
  });

  const currentType = form.watch('type');
  const currentScope = form.watch('scope');
  const filteredCategories = categories.filter(c => c.type === currentType && c.scope === currentScope);

  const saveBudgetMutation = useMutation({
    mutationFn: async (data: BudgetFormValues) => {
      if (!userId) throw new Error("Usuário não autenticado.");

      const payload = {
        ...data,
        user_id: userId,
        start_date: format(convertToUtc(data.start_date)!, 'yyyy-MM-dd'),
        end_date: format(convertToUtc(data.end_date)!, 'yyyy-MM-dd'),
        category_id: data.category_id || null,
      };

      if (initialData?.id) {
        const { error } = await supabase.from('budgets').update(payload).eq('id', initialData.id).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('budgets').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      showSuccess(`Orçamento ${initialData?.id ? 'atualizado' : 'adicionado'} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["companyBudgets", userId] });
      queryClient.invalidateQueries({ queryKey: ["personalBudgets", userId] });
      onBudgetSaved();
    },
    onError: (error: any) => {
      showError("Erro ao salvar orçamento: " + error.message);
    },
  });

  const onSubmit = (data: BudgetFormValues) => {
    saveBudgetMutation.mutate(data);
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
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Orçamento</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Marketing Mensal" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
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

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Alvo (R$)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="1000.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data de Início</FormLabel>
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

          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data de Fim</FormLabel>
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

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saveBudgetMutation.isPending}>
            {saveBudgetMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : initialData ? (
              "Salvar Alterações"
            ) : (
              "Criar Orçamento"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default BudgetForm;