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
import TagSelector from "./TagSelector";
import { TaskRecurrenceType, TemplateTask, TemplateFormOriginBoard } from "@/types/task";
import TimePicker from "./TimePicker"; 
import { useQueryClient } from "@tanstack/react-query";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante

const DAYS_OF_WEEK = [
  { value: "Sunday", label: "Domingo" },
  { value: "Monday", label: "Segunda-feira" },
  { value: "Tuesday", label: "Terça-feira" },
  { value: "Wednesday", label: "Quarta-feira" },
  { value: "Thursday", label: "Quinta-feira" },
  { value: "Friday", label: "Sexta-feira" },
  { value: "Saturday", label: "Sábado" },
];

const templateTaskSchema = z.object({
  title: z.string().min(1, "O título da tarefa padrão é obrigatório."),
  description: z.string().optional(),
  recurrence_type: z.enum(["none", "daily", "weekly", "monthly", "yearly"]).default("none"),
  recurrence_details: z.string().optional().nullable(),
  recurrence_time: z.string().optional().nullable(),
  origin_board: z.enum(["general", "today_priority", "today_no_priority", "jobs_woe_today"]).default("general"),
  selected_tag_ids: z.array(z.string()).optional(),
});

export type TemplateTaskFormValues = z.infer<typeof templateTaskSchema>;

interface TemplateTaskFormProps {
  initialData?: Omit<TemplateTaskFormValues, 'recurrence_details' | 'origin_board' | 'recurrence_time'> & {
    id: string;
    recurrence_details?: string | null;
    recurrence_time?: string | null;
    tags?: { id: string; name: string; color: string }[];
    origin_board: TemplateFormOriginBoard;
  };
  onTemplateTaskSaved: () => void;
  onClose: () => void;
}

const TemplateTaskForm: React.FC<TemplateTaskFormProps> = ({ initialData, onTemplateTaskSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const form = useForm<TemplateTaskFormValues>({
    resolver: zodResolver(templateTaskSchema),
    defaultValues: initialData ? {
      title: initialData.title,
      description: initialData.description || undefined,
      recurrence_type: initialData.recurrence_type,
      recurrence_details: initialData.recurrence_details || undefined,
      recurrence_time: initialData.recurrence_time || undefined,
      origin_board: initialData.origin_board,
      selected_tag_ids: initialData.tags?.map(tag => tag.id) || [],
    } : {
      title: "",
      description: "",
      recurrence_type: "none",
      recurrence_details: undefined,
      recurrence_time: undefined,
      origin_board: "general",
      selected_tag_ids: [],
    },
  });

  const recurrenceType = form.watch("recurrence_type");
  const selectedTagIds = form.watch("selected_tag_ids") || [];
  const watchedRecurrenceDetails = form.watch("recurrence_details");

  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  useEffect(() => {
    if (recurrenceType === "weekly" && watchedRecurrenceDetails) {
      setSelectedDays(watchedRecurrenceDetails.split(','));
    } else {
      setSelectedDays([]);
    }
  }, [recurrenceType, watchedRecurrenceDetails]);

  const handleDayToggle = (dayValue: string) => {
    setSelectedDays(prev => {
      const newDays = prev.includes(dayValue)
        ? prev.filter(d => d !== dayValue)
        : [...prev, dayValue];
      form.setValue("recurrence_details", newDays.join(','), { shouldDirty: true });
      return newDays;
    });
  };

  const handleTagSelectionChange = (newSelectedTagIds: string[]) => {
    form.setValue("selected_tag_ids", newSelectedTagIds, { shouldDirty: true });
  };

  const onSubmit = async (values: TemplateTaskFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      let templateTaskId: string;

      const dataToSave = {
        title: values.title,
        description: values.description || null,
        recurrence_type: values.recurrence_type,
        recurrence_details: values.recurrence_type === "weekly" ? selectedDays.join(',') || null : values.recurrence_details || null,
        recurrence_time: values.recurrence_time || null,
        origin_board: values.origin_board,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { data, error } = await supabase
          .from("template_tasks")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId)
          .select("id")
          .single();

        if (error) throw error;
        templateTaskId = data.id;
        showSuccess("Tarefa padrão atualizada com sucesso!");
      } else {
        const { data, error } = await supabase.from("template_tasks").insert({
          ...dataToSave,
          user_id: userId,
        }).select("id").single();

        if (error) throw error;
        templateTaskId = data.id;
        showSuccess("Tarefa padrão adicionada com sucesso!");
      }

      await supabase.from("template_task_tags").delete().eq("template_task_id", templateTaskId);

      if (values.selected_tag_ids && values.selected_tag_ids.length > 0) {
        const templateTaskTagsToInsert = values.selected_tag_ids.map(tagId => ({
          template_task_id: templateTaskId,
          tag_id: tagId,
        }));
        const { error: tagInsertError } = await supabase.from("template_task_tags").insert(templateTaskTagsToInsert);
        if (tagInsertError) throw tagInsertError;
      }

      form.reset();
      onTemplateTaskSaved();
      onClose();
      queryClient.invalidateQueries({ queryKey: ["templateTasks", userId] });
    } catch (error: any) {
      showError("Erro ao salvar tarefa padrão: " + error.message);
      console.error("Erro ao salvar tarefa padrão:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass card-hover-effect">
      <div>
        <Label htmlFor="title" className="text-foreground">Título</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Fazer exercícios matinais"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.title && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="description" className="text-foreground">Descrição (Opcional)</Label>
        <Textarea
          id="description"
          {...form.register("description")}
          placeholder="Detalhes da tarefa padrão (ex: 30 minutos de leitura, 10 páginas, 1h de estudo)..."
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      
      <div>
        <Label htmlFor="recurrence_type" className="text-foreground">Recorrência</Label>
        <Select
          onValueChange={(value: TaskRecurrenceType) => {
            form.setValue("recurrence_type", value);
            form.setValue("recurrence_details", null);
            form.setValue("recurrence_time", null); 
            setSelectedDays([]);
          }}
          value={recurrenceType}
        >
          <SelectTrigger id="recurrence_type" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar tipo de recorrência" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="none">Nenhuma</SelectItem>
            <SelectItem value="daily">Diário</SelectItem>
            <SelectItem value="weekly">Semanal (selecionar dias)</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {recurrenceType !== "none" && (
        <div>
          <Label htmlFor="recurrence_time" className="text-foreground">Horário de Recorrência (Opcional)</Label>
          <TimePicker
            value={form.watch("recurrence_time") || null}
            onChange={(time) => form.setValue("recurrence_time", time || null)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Se definido, a tarefa será criada com este horário e você receberá uma notificação.
          </p>
        </div>
      )}

      {recurrenceType === "weekly" && (
        <div>
          <Label className="text-foreground">Dias da Semana</Label>
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
          {form.formState.errors.recurrence_details && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.recurrence_details.message}
            </p>
          )}
        </div>
      )}

      {recurrenceType === "monthly" && (
        <div>
          <Label htmlFor="recurrence_details_monthly" className="text-foreground">Dia do Mês</Label>
          <Input
            id="recurrence_details_monthly"
            type="number"
            min="1"
            max="31"
            {...form.register("recurrence_details", { valueAsNumber: true })}
            placeholder="Ex: 15"
            className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
          />
          {form.formState.errors.recurrence_details && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.recurrence_details.message}
            </p>
          )}
        </div>
      )}

      <div>
        <Label htmlFor="origin_board" className="text-foreground">Quadro de Origem</Label>
        <Select
          onValueChange={(value: TemplateFormOriginBoard) => form.setValue("origin_board", value)}
          value={form.watch("origin_board")}
        >
          <SelectTrigger id="origin_board" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar quadro" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="general">Geral</SelectItem>
            <SelectItem value="today_priority">Hoje - Prioridade</SelectItem>
            <SelectItem value="today_no_priority">Hoje - Sem Prioridade</SelectItem>
            <SelectItem value="jobs_woe_today">Jobs Woe hoje</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TagSelector
        selectedTagIds={selectedTagIds}
        onTagSelectionChange={handleTagSelectionChange}
      />

      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData?.id ? "Atualizar Tarefa Padrão" : "Adicionar Tarefa Padrão"}
      </Button>
    </form>
  );
};

export default TemplateTaskForm;