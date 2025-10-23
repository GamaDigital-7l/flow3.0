"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CalendarIcon, Repeat } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { RecurringTask, TaskRecurrenceType, DAYS_OF_WEEK_MAP, DAYS_OF_WEEK_LABELS } from "@/types/task";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const FREQUENCY_OPTIONS: TaskRecurrenceType[] = ['daily', 'weekly', 'custom'];

const recurringTaskSchema = z.object({
  title: z.string().min(1, "O título é obrigatório."),
  description: z.string().optional().nullable(),
  frequency: z.enum(FREQUENCY_OPTIONS, { required_error: "A frequência é obrigatória." }),
  weekdays: z.array(z.number()).optional().nullable(),
  paused: z.boolean().default(false),
});

export type RecurringTaskFormValues = z.infer<typeof recurringTaskSchema>;

interface RecurringTaskFormProps {
  initialData?: RecurringTask;
  onTaskSaved: () => void;
  onClose: () => void;
}

const RecurringTaskForm: React.FC<RecurringTaskFormProps> = ({ initialData, onTaskSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const form = useForm<RecurringTaskFormValues>({
    resolver: zodResolver(recurringTaskSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || null,
      frequency: initialData?.frequency || "daily",
      weekdays: initialData?.weekdays || [],
      paused: initialData?.paused || false,
    },
  });

  const frequency = form.watch("frequency");
  const watchedWeekdays = form.watch("weekdays") || [];

  const handleDayToggle = (dayValue: number) => {
    const newDays = watchedWeekdays.includes(dayValue)
      ? watchedWeekdays.filter(d => d !== dayValue)
      : [...watchedWeekdays, dayValue];
    form.setValue("weekdays", newDays, { shouldDirty: true });
  };

  const saveTaskMutation = useMutation({
    mutationFn: async (values: RecurringTaskFormValues) => {
      if (!userId) throw new Error("Usuário não autenticado.");

      const isEditing = !!initialData?.id;
      const recurrenceId = isEditing ? initialData!.recurrence_id : crypto.randomUUID();
      const todayLocal = format(new Date(), 'yyyy-MM-dd'); // Usamos a data local do servidor/cliente como fallback

      const dataToSave = {
        recurrence_id: recurrenceId,
        user_id: userId,
        title: values.title,
        description: values.description || null,
        frequency: values.frequency,
        weekdays: (values.frequency === 'weekly' || values.frequency === 'custom') ? values.weekdays : null,
        paused: values.paused,
        // Campos de métricas são resetados/inicializados apenas na criação do template
        streak: isEditing ? initialData!.streak : 0,
        total_completed: isEditing ? initialData!.total_completed : 0,
        missed_days: isEditing ? initialData!.missed_days : [],
        fail_by_weekday: isEditing ? initialData!.fail_by_weekday : {0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0},
        success_rate: isEditing ? initialData!.success_rate : 0,
        alert: false,
        updated_at: new Date().toISOString(),
      };

      if (isEditing) {
        // 1. Atualiza o template (onde id == recurrence_id)
        const { error: updateError } = await supabase
          .from("recurring_tasks")
          .update(dataToSave)
          .eq("id", initialData!.id)
          .eq("recurrence_id", initialData!.id)
          .eq("user_id", userId);

        if (updateError) throw updateError;
        showSuccess("Hábito atualizado com sucesso!");
      } else {
        // 1. Cria o template (id == recurrence_id)
        const { error: insertError } = await supabase.from("recurring_tasks").insert({
          ...dataToSave,
          date_local: todayLocal, // Data de criação do template
          completed_today: false,
          // O ID da primeira instância é o próprio recurrence_id
          id: recurrenceId, 
        });

        if (insertError) throw insertError;
        showSuccess("Hábito adicionado com sucesso!");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurringTemplates", userId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardRecurringTasks", userId] });
      onTaskSaved();
    },
    onError: (error: any) => {
      showError("Erro ao salvar hábito: " + error.message);
      console.error("Erro ao salvar hábito:", error);
    },
  });

  const onSubmit = (values: RecurringTaskFormValues) => {
    saveTaskMutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass card-hover-effect">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground">Hábito</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: Beber 2L de água"
                  className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground">Descrição (Opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Detalhes do hábito..."
                  className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="frequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground">Frequência</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
                    <SelectValue placeholder="Selecionar frequência" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal (Dias Específicos)</SelectItem>
                  <SelectItem value="custom">Personalizado (Dias Específicos)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {(frequency === "weekly" || frequency === "custom") && (
          <FormItem>
            <FormLabel className="text-foreground">Dias da Semana</FormLabel>
            <div className="grid grid-cols-7 gap-1 mt-2">
              {Object.entries(DAYS_OF_WEEK_LABELS).map(([dayIndexStr, label]) => {
                const dayIndex = parseInt(dayIndexStr);
                const isSelected = watchedWeekdays.includes(dayIndex);
                return (
                  <Button
                    key={dayIndex}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="icon"
                    onClick={() => handleDayToggle(dayIndex)}
                    className={cn(
                      "h-9 w-full text-xs",
                      isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-input border-border text-foreground hover:bg-accent"
                    )}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
            <FormMessage />
          </FormItem>
        )}
        
        {initialData && (
          <FormField
            control={form.control}
            name="paused"
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
                    Pausar Hábito
                  </FormLabel>
                  <FormDescription className="text-muted-foreground">
                    Se pausado, o hábito não aparecerá no Dashboard nem contará para métricas.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        )}

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={saveTaskMutation.isPending}>
          {saveTaskMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (initialData ? "Atualizar Hábito" : "Adicionar Hábito")}
        </Button>
      </form>
    </Form>
  );
};

export default RecurringTaskForm;