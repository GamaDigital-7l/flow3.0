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
import { FinancialGoal } from '@/types/finance';
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
  target_amount: z.number().min(0.01, "O valor alvo deve ser positivo."),
  current_amount: z.number().min(0, "O valor atual não pode ser negativo."),
  target_date: z.date().nullable().optional(),
  linked_account_id: z.string().min(1, "A conta vinculada é obrigatória."), // Required
});

type FinancialGoalFormValues = z.infer<typeof formSchema>;

interface FinancialGoalFormProps {
  initialData?: FinancialGoal | null;
  onGoalSaved: () => void;
  onClose: () => void;
}

const FinancialGoalForm: React.FC<FinancialGoalFormProps> = ({ initialData, onGoalSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const { accounts, isLoading } = useFinancialData();

  const defaultValues: Partial<FinancialGoalFormValues> = {
    name: initialData?.name || "",
    target_amount: initialData?.target_amount || 0,
    current_amount: initialData?.current_amount || 0,
    target_date: initialData?.target_date ? new Date(initialData.target_date) : undefined,
    linked_account_id: initialData?.linked_account_id || null,
  };

  const form = useForm<FinancialGoalFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues as FinancialGoalFormValues,
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        ...defaultValues,
        target_date: initialData.target_date ? new Date(initialData.target_date) : undefined,
      } as FinancialGoalFormValues);
    }
  }, [initialData]);

  const onSubmit = async (values: FinancialGoalFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    const goalData = {
      ...values,
      user_id: userId,
      target_date: values.target_date ? format(values.target_date, 'yyyy-MM-dd') : null,
      linked_account_id: values.linked_account_id,
    };

    try {
      if (initialData?.id) {
        // Update
        const { error } = await supabase
          .from("financial_goals")
          .update(goalData)
          .eq("id", initialData.id)
          .select();

        if (error) throw error;
        showSuccess("Meta atualizada com sucesso!");
      } else {
        // Create
        const { error } = await supabase
          .from("financial_goals")
          .insert(goalData)
          .select();

        if (error) throw error;
        showSuccess("Meta registrada com sucesso!");
      }
      onGoalSaved();
      onClose();
    } catch (err: any) {
      showError("Erro ao salvar meta: " + err.message);
      console.error("Erro ao salvar meta:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
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
              <FormLabel>Nome da Meta</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Reserva de Emergência" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="target_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Alvo (R$)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="10000.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="current_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Atual (R$)</FormLabel>
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
            name="target_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data Alvo (Opcional)</FormLabel>
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
            name="linked_account_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Conta Vinculada</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
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
              "Criar Meta"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default FinancialGoalForm;