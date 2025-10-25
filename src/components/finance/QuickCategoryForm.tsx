import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FinancialTransactionType, FinancialScope } from '@/types/finance';

const quickCategorySchema = z.object({
  name: z.string().min(1, "O nome da categoria é obrigatório."),
  type: z.enum(["income", "expense"]),
  scope: z.enum(["company", "personal"]),
});

type QuickCategoryFormValues = z.infer<typeof quickCategorySchema>;

interface QuickCategoryFormProps {
  onCategorySaved: () => void;
  onClose: () => void;
}

const QuickCategoryForm: React.FC<QuickCategoryFormProps> = ({ onCategorySaved, onClose }) => {
  const form = useForm<QuickCategoryFormValues>({
    resolver: zodResolver(quickCategorySchema),
    defaultValues: {
      name: "",
      type: "expense",
      scope: "company",
    },
  });

  const onSubmit = (values: QuickCategoryFormValues) => {
    onCategorySaved();
    onClose();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome da Categoria</FormLabel>
            <FormControl>
              <Input placeholder="Ex: Aluguel, Salário" {...field} />
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
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="scope"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Escopo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o escopo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="company">Empresa</SelectItem>
                    <SelectItem value="personal">Pessoal</SelectItem>
                  </SelectContent>
                  <FormMessage />
                </FormItem>
              )}
            )}
        />
        </div>
      </div>

      <Button type="submit">Salvar Categoria</Button>
    </form>
  );
};

export default QuickCategoryForm;