"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { FinancialCategory, FinancialScope, FinancialTransactionType } from "@/types/finance";
import { useQueryClient } from "@tanstack/react-query";

const categorySchema = z.object({
  name: z.string().min(1, "O nome da categoria é obrigatório."),
  type: z.enum(["income", "expense"]),
  scope: z.enum(["company", "personal"]),
});

export type FinancialCategoryFormValues = z.infer<typeof categorySchema>;

interface FinancialCategoryFormProps {
  initialData?: FinancialCategory;
  onCategorySaved: () => void;
  onClose: () => void;
}

const FinancialCategoryForm: React.FC<FinancialCategoryFormProps> = ({ initialData, onCategorySaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const form = useForm<FinancialCategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: initialData || {
      name: "",
      type: "expense",
      scope: "company",
    },
  });

  const onSubmit = async (values: FinancialCategoryFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      if (initialData?.id) {
        const { error } = await supabase
          .from("financial_categories")
          .update({
            name: values.name,
            type: values.type,
            scope: values.scope,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initialData.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Categoria atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("financial_categories").insert({
          name: values.name,
          type: values.type,
          scope: values.scope,
          user_id: userId,
        });

        if (error) throw error;
        showSuccess("Categoria adicionada com sucesso!");
      }
      form.reset();
      onCategorySaved();
      onClose();
      queryClient.invalidateQueries({ queryKey: ["financialData", userId] });
    } catch (error: any) {
      showError("Erro ao salvar categoria: " + error.message);
      console.error("Erro ao salvar categoria:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass">
      <div>
        <Label htmlFor="name" className="text-foreground">Nome da Categoria</Label>
        <Input
          id="name"
          {...form.register("name")}
          placeholder="Ex: Aluguel, Salário, Marketing"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.name && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type" className="text-foreground">Tipo</Label>
          <Select
            onValueChange={(value: FinancialTransactionType) => form.setValue("type", value)}
            value={form.watch("type")}
          >
            <SelectTrigger id="type" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
              <SelectItem value="income">Receita</SelectItem>
              <SelectItem value="expense">Despesa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="scope" className="text-foreground">Escopo</Label>
          <Select
            onValueChange={(value: FinancialScope) => form.setValue("scope", value)}
            value={form.watch("scope")}
          >
            <SelectTrigger id="scope" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
              <SelectValue placeholder="Escopo" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
              <SelectItem value="company">Empresa</SelectItem>
              <SelectItem value="personal">Pessoal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData ? "Atualizar Categoria" : "Adicionar Categoria"}
      </Button>
    </form>
  );
};

export default FinancialCategoryForm;