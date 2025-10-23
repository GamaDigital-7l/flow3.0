"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { FinancialTransactionType } from "@/types/finance";

const categorySchema = z.object({
  name: z.string().min(1, "O nome da categoria é obrigatório."),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  onCategorySaved: () => void;
  onClose: () => void;
  type: FinancialTransactionType;
}

const CategoryForm: React.FC<CategoryFormProps> = ({ onCategorySaved, onClose, type }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
    },
  });

  const onSubmit = async (values: CategoryFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const { error } = await supabase.from("financial_categories").insert({
        name: values.name,
        type: type,
        user_id: userId,
        scope: "company", // Defina o escopo apropriado aqui
      });

      if (error) throw error;
      showSuccess("Categoria adicionada com sucesso!");
      form.reset();
      onCategorySaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar categoria: " + error.message);
      console.error("Erro ao salvar categoria:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name" className="text-foreground">Nome da Categoria</Label>
        <Input
          id="name"
          {...form.register("name")}
          placeholder="Ex: Aluguel, Salário"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.name && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        Adicionar Categoria
      </Button>
    </form>
  );
};

export default CategoryForm;