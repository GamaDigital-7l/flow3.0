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
import { FinancialAccount } from "@/types/finance";
import { useQueryClient } from "@tanstack/react-query";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante

const accountSchema = z.object({
  name: z.string().min(1, "O nome da conta é obrigatório."),
  type: z.enum(["checking", "savings", "investment", "cash"]),
  current_balance: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0, "O saldo não pode ser negativo.")
  ),
});

export type FinancialAccountFormValues = z.infer<typeof accountSchema>;

interface FinancialAccountFormProps {
  initialData?: FinancialAccount;
  onAccountSaved: () => void;
  onClose: () => void;
}

const FinancialAccountForm: React.FC<FinancialAccountFormProps> = ({ initialData, onAccountSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const form = useForm<FinancialAccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: initialData || {
      name: "",
      type: "checking",
      current_balance: 0,
    },
  });

  const onSubmit = async (values: FinancialAccountFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      if (initialData?.id) {
        const { error } = await supabase
          .from("financial_accounts")
          .update({
            name: values.name,
            type: values.type,
            current_balance: values.current_balance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initialData.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Conta atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("financial_accounts").insert({
          name: values.name,
          type: values.type,
          current_balance: values.current_balance,
          user_id: userId,
        });

        if (error) throw error;
        showSuccess("Conta adicionada com sucesso!");
      }
      form.reset();
      onAccountSaved();
      onClose();
      queryClient.invalidateQueries({ queryKey: ["financialAccounts", userId] });
    } catch (error: any) {
      showError("Erro ao salvar conta: " + error.message);
      console.error("Erro ao salvar conta:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass">
      <div>
        <Label htmlFor="name" className="text-foreground">Nome da Conta</Label>
        <Input
          id="name"
          {...form.register("name")}
          placeholder="Ex: Conta Corrente, Poupança"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.name && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="type" className="text-foreground">Tipo de Conta</Label>
        <Select
          onValueChange={(value) => form.setValue("type", value as "checking" | "savings" | "investment" | "cash")}
          value={form.watch("type") || ""}
        >
          <SelectTrigger id="type" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar tipo de conta" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="checking">Conta Corrente</SelectItem>
            <SelectItem value="savings">Poupança</SelectItem>
            <SelectItem value="investment">Investimento</SelectItem>
            <SelectItem value="cash">Dinheiro em Espécie</SelectItem>
          </SelectContent>
        </Select>
        {form.formState.errors.type && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.type.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="current_balance" className="text-foreground">Saldo Atual</Label>
        <Input
          id="current_balance"
          type="number"
          step="0.01"
          {...form.register("current_balance", { valueAsNumber: true })}
          placeholder="Ex: 1500.00"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.current_balance && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.current_balance.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData ? "Atualizar Conta" : "Adicionar Conta"}
      </Button>
    </form>
  );
};

export default FinancialAccountForm;