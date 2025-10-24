// src/components/HabitForm.tsx
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CalendarDays } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Habit, HabitFrequency, WEEKDAY_LABELS } from "@/types/habit";
import { getTodayLocalString } from "@/lib/utils"; // Importando getTodayLocalString

const habitSchema = z.object({
  title: z.string().min(1, "O título é obrigatório."),
  description: z.string().optional().nullable(),
  frequency: z.enum(["daily", "weekly", "custom"]).default("daily"),
  weekdays: z.array(z.number()).optional().nullable(),
  paused: z.boolean().default(false),
});

export type HabitFormValues = z.infer<typeof habitSchema>;

interface HabitFormProps {
  initialData?: Habit;
  onHabitSaved: () => void;
  onClose: () => void;
}

const HabitForm: React.FC<HabitFormProps> = ({ initialData, onHabitSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const form = useForm<HabitFormValues>({
    resolver: zodResolver(habitSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || null,
      frequency: initialData?.frequency || "daily",
      weekdays: initialData?.weekdays || [],
      paused: initialData?.paused || false,
    },
  });

  const currentFrequency = form.watch("frequency");
  const currentWeekdays = form.watch("weekdays") || [];

  const handleWeekdayToggle = (dayIndex: number) => {
    const newWeekdays = currentWeekdays.includes(dayIndex)
      ? currentWeekdays.filter(d => d !== dayIndex)
      : [...currentWeekdays, dayIndex].sort();
    form.setValue("weekdays", newWeekdays, { shouldDirty: true });
  };

  const saveHabitMutation = useMutation({
    mutationFn: async (values: HabitFormValues) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      
      // Usando a data local do navegador para a criação da instância
      const todayLocal = getTodayLocalString();

      const dataToSave = {
        title: values.title,
        description: values.description || null,
        frequency: values.frequency,
        weekdays: (values.frequency === 'weekly' || values.frequency === 'custom') ? values.weekdays : null,
        paused: values.paused,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.recurrence_id) {
        // Update: Update all instances sharing the recurrence_id
        // We only update the definition fields (title, description, frequency, weekdays, paused)
        const { error } = await supabase
          .from("habits")
          .update(dataToSave)
          .eq("recurrence_id", initialData.recurrence_id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Hábito atualizado com sucesso!");
      } else {
        // Create: Insert the first instance for today, initializing metrics
        const recurrenceId = crypto.randomUUID();
        const { error } = await supabase.from("habits").insert({
          ...dataToSave,
          recurrence_id: recurrenceId,
          user_id: userId,
          date_local: todayLocal,
          completed_today: false,
          streak: 0,
          total_completed: 0,
          missed_days: [],
          fail_by_weekday: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 },
          success_rate: 0,
          alert: false,
          last_completed_date_local: null, // Garantir que a primeira instância tenha métricas limpas
        });

        if (error) throw error;
        showSuccess("Hábito adicionado com sucesso!");
      }
    },
    onSuccess: () => {
      // Invalidate both queries to refresh the lists
      queryClient.invalidateQueries({ queryKey: ["todayHabits", userId] });
      queryClient.invalidateQueries({ queryKey: ["allHabitDefinitions", userId] });
      onHabitSaved();
    },
    onError: (error: any) => {
      showError("Erro ao salvar hábito: " + error.message);
    },
  });

  const onSubmit = (values: HabitFormValues) => {
    saveHabitMutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl card-hover-effect">
        
        {/* ... (restante do formulário) */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título do Hábito</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Beber 2L de água" {...field} />
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
              <FormLabel>Descrição (Opcional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Detalhes do hábito..." {...field} value={field.value || ''} />
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
              <FormLabel>Frequência</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a frequência" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal (Dias Específicos)</SelectItem>
                  <SelectItem value="custom">Personalizado (Semanal)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {(currentFrequency === 'weekly' || currentFrequency === 'custom') && (
          <FormField
            control={form.control}
            name="weekdays"
            render={() => (
              <FormItem>
                <FormLabel>Dias da Semana</FormLabel>
                <FormDescription>Selecione os dias em que este hábito é elegível.</FormDescription>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(WEEKDAY_LABELS).map(([dayIndexStr, label]) => {
                    const dayIndex = parseInt(dayIndexStr);
                    const isSelected = currentWeekdays.includes(dayIndex);
                    return (
                      <Button
                        key={dayIndex}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleWeekdayToggle(dayIndex)}
                        className="h-8 w-10 text-xs"
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        
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
                <FormLabel>
                  Pausar Hábito
                </FormLabel>
                <FormDescription className="text-muted-foreground">
                  Se pausado, o hábito não aparecerá no dashboard e não contará como falha.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={saveHabitMutation.isPending}>
          {saveHabitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (initialData ? "Atualizar Hábito" : "Adicionar Hábito")}
        </Button>
      </form>
    </Form>
  );
};

export default HabitForm;