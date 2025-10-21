"use client";

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
import { FinancialRecurrence } from '@/types/finance';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showError, showSuccess } from '@/utils/toast';
import { useFinancialData } from '@/hooks/useFinancialData';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  description: z.string().min(1, "A descrição é obrigatória."),
  amount: z.number().min(0.01, "O valor deve ser positivo."),
  type: z.enum(["income", "expense"], { required_error: "O tipo é obrigatório." }),
  frequency: z.enum(["monthly", "weekly", "yearly", "quarterly"], { required_error: "A frequência é obrigatória." }),
  next_due_date: z.date({ required_error: "A próxima data de vencimento é obrigatória." }),
  category_id: z.string().nullable().optional(),
  account_id: z.string().min(1, "A conta é obrigatória."),
});

type RecurrenceFormValues = z.infer<typeof formSchema>;

interface RecurrenceFormProps {
  initialData?: FinancialRecurrence | null;
  onRecurrenceSaved: () => void;
  onClose: () => void;
}

const RecurrenceForm: React.FC<RecurrenceFormProps> = ({ initialData, onRecurrenceSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const { categories, accounts, isLoading } = useFinancialData();

  const defaultValues: Partial<RecurrenceFormValues> = {
    description: initialData?.description || "",
    amount: initialData?.amount || 0,
    type: initialData?.type || "expense",
    frequency: initialData?.frequency || "monthly",
    next_due_date: initialData?.next_due_date ? new Date(initialData.next_due_date) : new Date(),
    category_id: initialData?.category_id || null,
    account_id: initialData?.account_id || "",
  };

  const form = useForm<RecurrenceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues as RecurrenceFormValues,
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        ...defaultValues,
        next_due_date: initialData.next_due_date ? new Date(initialData.next_due_date) : new Date(),
      } as RecurrenceFormValues);
    }
  }, [initialData]);

  const onSubmit = async (values: RecurrenceFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    const recurrenceData = {
      ...values,
      user_id: userId,
      next_due_date: format(values.next_due_date, 'yyyy-MM-dd'),
      // Ensure null value for optional field
      category_id: values.category_id === '__none__' ? null : values.category_id,
    };

    try {
      if (initialData?.id) {
        // Update
        const { error } = await supabase
          .from("financial_recurrences")
          .update(recurrenceData)
          .eq("id", initialData.id)
          .select();

        if (error) throw error;
        showSuccess("Recorrência atualizada com sucesso!");
      } else {
        // Create
        const { error } = await supabase
          .from("financial_recurrences")
          .insert(recurrenceData)
          .select();

        if (error) throw error;
        showSuccess("Recorrência registrada com sucesso!");
      }
      onRecurrenceSaved();
      onClose();
    } catch (err: any) {
      showError("Erro ao salvar recorrência: " + err.message);
      console.error("Erro ao salvar recorrência:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const currentCategories = form.watch('type') === 'income' ? incomeCategories : expenseCategories;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
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
          <FormField
            control={form.control}
            name="frequency"
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

          <FormField
            control={form.control}
            name="next_due_date"
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
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Selecione uma data</span>}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
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

export default RecurrenceForm;