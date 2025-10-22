"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { TaskOriginBoard } from "@/types/task";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";

const DAYS_OF_WEEK = [
  { value: "Sunday", label: "Domingo" },
  { value: "Monday", label: "Segunda-feira" },
  { value: "Tuesday", label: "Terça-feira" },
  { value: "Wednesday", label: "Quarta-feira" },
  { value: "Thursday", label: "Quinta-feira" },
  { value: "Friday", label: "Sexta-feira" },
  { value: "Saturday", label: "Sábado" },
];

const standardTaskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "O título da tarefa padrão é obrigatório."),
  description: z.string().optional().nullable(),
  recurrence_days: z.string().min(1, "Selecione pelo menos um dia da semana."),
  origin_board: z.enum(["general", "today_high_priority", "today_medium_priority", "week_low_priority", "urgent"]).default("general"),
  is_active: z.boolean().default(true),
});

export type StandardTaskFormValues = z.infer<typeof standardTaskSchema>;

interface StandardTaskFormProps {
  initialData?: StandardTaskFormValues & { id: string };
  onTemplateSaved: () => void;
  onClose: () => void;
}

const StandardTaskForm: React.FC<StandardTaskFormProps> = ({ initialData, onTemplateSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const form = useForm<StandardTaskFormValues>({
    resolver: zodResolver(standardTaskSchema),
    defaultValues: initialData ? {
      ...initialData,
      description: initialData.description || null,
      recurrence_days: initialData.recurrence_days || "", // Garantir string vazia
    } : {
      title: "",
      description: null,
      recurrence_days: "",
      origin_board: "today_high_priority",
      is_active: true,
    },
  });

  const watchedRecurrenceDays = form.watch("recurrence_days");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  useEffect(() => {
    if (watchedRecurrenceDays) {
      setSelectedDays(watchedRecurrenceDays.split(',').map(d => d.trim()).filter(d => d !== ''));
    }
  }, [watchedRecurrenceDays]);

  const handleDayToggle = (dayValue: string) => {
    setSelectedDays(prev => {
      const newDays = prev.includes(dayValue)
        ? prev.filter(d => d !== dayValue)
        : [...prev, dayValue];
      
      const sortedDays = DAYS_OF_WEEK.filter(d => newDays.includes(d.value)).map(d => d.value);
      form.setValue("recurrence_days", sortedDays.join(','), { shouldDirty: true });
      return newDays;
    });
  };

  const onSubmit = async (values: StandardTaskFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    if (selectedDays.length === 0) {
      form.setError("recurrence_days", { message: "Selecione pelo menos um dia." });
      return;
    }

    try {
      const dataToSave = {
        title: values.title,
        description: values.description || null,
        recurrence_days: values.recurrence_days,
        origin_board: values.origin_board,
        is_active: values.is_active,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("standard_task_templates")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Template padrão atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("standard_task_templates").insert({
          ...dataToSave,
          user_id: userId,
        });

        if (error) throw error;
        showSuccess("Template padrão adicionado com sucesso!");
      }

      form.reset();
      onTemplateSaved();
      onClose();
      queryClient.invalidateQueries({ queryKey: ["standardTemplates", userId] });
    } catch (error: any) {
      showError("Erro ao salvar template padrão: " + error.message);
      console.error("Erro ao salvar template padrão:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass card-hover-effect">
        {/* Título */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Post Rutherford" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Descrição */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição (Opcional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Detalhes da tarefa padrão..." {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Quadro de Destino */}
        <FormField
          control={form.control}
          name="origin_board"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quadro de Destino</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
                    <SelectValue placeholder="Selecionar quadro" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                  <SelectItem value="today_high_priority">Hoje - Prioridade Alta</SelectItem>
                  <SelectItem value="today_medium_priority">Hoje - Prioridade Média</SelectItem>
                  <SelectItem value="week_low_priority">Esta Semana - Baixa</SelectItem>
                  <SelectItem value="general">Geral</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Dias da Semana */}
        <FormItem>
          <FormLabel className="text-foreground">Dias de Reaparecimento</FormLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`day-${day.value}`}
                  checked={selectedDays.includes(day.value)}
                  onCheckedChange={() => handleDayToggle(day.value)}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
                />
                <Label htmlFor={`day-${day.value}`} className="text-foreground">
                  {day.label}
                </Label>
              </div>
            ))}
          </div>
          {form.formState.errors.recurrence_days && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.recurrence_days.message}
            </p>
          )}
          <FormDescription>
            A tarefa será criada no quadro de destino em cada um desses dias, se não houver uma instância pendente.
          </FormDescription>
        </FormItem>

        {/* Ativo */}
        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-secondary/50">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-foreground">
                  Template Ativo
                </FormLabel>
                <FormDescription className="text-muted-foreground">
                  Desative para pausar a criação automática desta tarefa.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (initialData?.id ? "Atualizar Template" : "Adicionar Template")}
        </Button>
      </form>
    </Form>
  );
};

export default StandardTaskForm;