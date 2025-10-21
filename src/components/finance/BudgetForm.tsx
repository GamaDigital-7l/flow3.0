"use client";

import React, { useEffect } from 'react';
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
import { FinancialBudget } from '@/types/finance';
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
  name: z.string().min(1, "O nome é obrigatório."),
  amount: z.number().min(0.01, "O valor deve ser positivo."),
  type: z.enum(["income", "expense"], { required_error: "O tipo é obrigatório." }),
  start_date: z.date({ required_error: "A data de início é obrigatória." }),
  end_date: z.date({ required_error: "A data de fim é obrigatória." }),
  category_id: z.string().nullable().optional(),
  scope: z.enum(["company", "personal"], { required_error: "O escopo é obrigatório." }),
});

type BudgetFormValues = z.infer<typeof formSchema>;

interface BudgetFormProps {
  initialData?: FinancialBudget | null;
  onBudgetSaved: () => void;
  onClose: () => void;
  defaultScope: "company" | "personal";
}

const BudgetForm: React.FC<BudgetFormProps> = ({ initialData, onBudgetSaved, onClose, defaultScope }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const { categories, isLoading } = useFinancialData();

  const defaultValues: Partial<BudgetFormValues> = {
    name: initialData?.name || "",
    amount: initialData?.amount || 0,
    type: initialData?.type || "expense",
    start_date: initialData?.start_date ? new Date(initialData.start_date) : new Date(),
    end_date: initialData?.end_date ? new Date(initialData.end_date) : new Date(),
    category_id: initialData?.category_id || null,
    scope: initialData?.scope || defaultScope,
  };

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues as BudgetFormValues,
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        ...defaultValues,
        start_date: initialData.start_date ? new Date(initialData.start_date) : new Date(),
        end_date: initialData.end_date ? new Date(initialData.end_date) : new Date(),
      } as BudgetFormValues);
    }
  }, [initialData]);

  const onSubmit = async (values: BudgetFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    const budgetData = {
      ...values,
      user_id: userId,
      start_date: format(values.start_date, 'yyyy-MM-dd'),
      end_date: format(values.end_date, 'yyyy-MM-dd'),
      // Ensure null value for optional field
      category_id: values.category_id === '__none__' ? null : values.category_id,
    };

    try {
      if (initialData?.id) {
        // Update
        const { error } = await supabase
          .from("budgets")
          .update(budgetData)
          .eq("id", initialData.id)
          .select();

        if (error) throw error;
        showSuccess("Orçamento atualizado com sucesso!");
      } else {
        // Create
        const { error } = await supabase
          .from("budgets")
          .insert(budgetData)
          .select();

        if (error) throw error;
        showSuccess("Orçamento registrado com sucesso!");
      }
      onBudgetSaved();
      onClose();
    } catch (err: any) {
      showError("Erro ao salvar orçamento: " + err.message);
      console.error("Erro ao salvar orçamento:", err);
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
                  <SelectItem value="__none__">Todas as Categorias</SelectItem>
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
              "Criar Orçamento"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default BudgetForm;