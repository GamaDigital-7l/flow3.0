"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { Checkbox } from "@/components/ui/checkbox";
import { ptBR } from "date-fns/locale/pt-BR";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const healthGoalSchema = z.object({
  title: z.string().min(1, "O título da meta é obrigatório."),
  initial_weight_kg: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().min(0.1, "O peso inicial deve ser um número positivo.").nullable(),
  ).refine(val => val !== null, "O peso inicial é obrigatório."),
  target_weight_kg: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().min(0.1, "O peso alvo deve ser um número positivo.").nullable(),
  ).refine(val => val !== null, "O peso alvo é obrigatório."),
  start_date: z.date().default(new Date()),
  target_date: z.date().refine(date => date >= new Date(new Date().setHours(0,0,0,0)), "A data alvo não pode ser no passado."),
  is_completed: z.boolean().default(false),
  description: z.string().optional().nullable(), 
  status: z.enum(["pending", "in_progress", "completed"]).default("pending"), 
});

export type HealthGoalFormValues = z.infer<typeof healthGoalSchema>;

interface HealthGoalFormProps {
  initialData?: HealthGoalFormValues & { id: string };
  onGoalSaved: () => void;
  onClose: () => void;
}

const HealthGoalForm: React.FC<HealthGoalFormProps> = ({ initialData, onGoalSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<HealthGoalFormValues>({
    resolver: zodResolver(healthGoalSchema),
    defaultValues: initialData ? {
      ...initialData,
      start_date: new Date(initialData.start_date),
      target_date: new Date(initialData.target_date),
    } : {
      title: "",
      initial_weight_kg: undefined,
      target_weight_kg: undefined,
      start_date: new Date(),
      target_date: undefined,
      is_completed: false,
      description: "",
      status: "pending",
    },
  });

  const onSubmit = async (values: HealthGoalFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const dataToSave = {
        title: values.title,
        initial_weight_kg: values.initial_weight_kg,
        target_weight_kg: values.target_weight_kg,
        start_date: format(values.start_date, "yyyy-MM-dd"),
        target_date: format(values.target_date, "yyyy-MM-dd"),
        is_completed: values.is_completed,
        description: values.description || null,
        status: values.status,
        updated_at: new Date().toISOString(),
      };

      if (initialData) {
        const { error } = await supabase
          .from("health_goals")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Meta de saúde atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("health_goals").insert({
          ...dataToSave,
          user_id: userId,
        });

        if (error) throw error;
        showSuccess("Meta de saúde adicionada com sucesso!");
      }
      form.reset();
      onGoalSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar meta de saúde: " + error.message);
      console.error("Erro ao salvar meta de saúde:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card">
      <div>
        <Label htmlFor="title" className="text-foreground">Título da Meta</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Perder 10kg"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.title && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="initial_weight_kg" className="text-foreground">Peso Inicial (kg)</Label>
        <Input
          id="initial_weight_kg"
          type="number"
          step="0.1"
          {...form.register("initial_weight_kg", { valueAsNumber: true })}
          placeholder="Ex: 80.5"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.initial_weight_kg && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.initial_weight_kg.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="target_weight_kg" className="text-foreground">Peso Alvo (kg)</Label>
        <Input
          id="target_weight_kg"
          type="number"
          step="0.1"
          {...form.register("target_weight_kg", { valueAsNumber: true })}
          placeholder="Ex: 70.0"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.target_weight_kg && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.target_weight_kg.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="start_date" className="text-foreground">Data de Início</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                !form.watch("start_date") && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
              {form.watch("start_date") ? (
                format(form.watch("start_date")!, "PPP", { locale: ptBR })
              ) : (
                <span>Escolha uma data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
            <Calendar
              mode="single"
              selected={form.watch("start_date") || undefined}
              onSelect={(date) => form.setValue("start_date", date || new Date())}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div>
        <Label htmlFor="target_date" className="text-foreground">Data Alvo</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                !form.watch("target_date") && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
              {form.watch("target_date") ? (
                format(form.watch("target_date")!, "PPP", { locale: ptBR })
              ) : (
                <span>Escolha uma data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
            <Calendar
              mode="single"
              selected={form.watch("target_date") || undefined}
              onSelect={(date) => form.setValue("target_date", date!)}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
        {form.formState.errors.target_date && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.target_date.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="status" className="text-foreground">Status</Label>
        <Select
          onValueChange={(value: "pending" | "in_progress" | "completed") =>
            form.setValue("status", value)
          }
          value={form.watch("status")}
        >
          <SelectTrigger id="status" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar status" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="in_progress">Em Progresso</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_completed"
          checked={form.watch("is_completed")}
          onCheckedChange={(checked) => form.setValue("is_completed", checked as boolean)}
          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
        />
        <Label htmlFor="is_completed" className="text-foreground">Meta Concluída</Label>
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData ? "Atualizar Meta" : "Adicionar Meta"}
      </Button>
    </form>
  );
};

export default HealthGoalForm;