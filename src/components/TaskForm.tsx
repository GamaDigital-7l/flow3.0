import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { formatDateTime, convertToUtc, formatISO, parseISO } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import TagSelector from "./TagSelector";
import TimePicker from "./TimePicker";
import { ptBR } from "date-fns/locale/pt-BR";
import { TaskRecurrenceType, TaskOriginBoard, Task } from "@/types/task";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import TaskBasicInfo from "./task/TaskBasicInfo";
import TaskCategorization from "./task/TaskCategorization";

const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "O título é obrigatório."),
  description: z.string().optional().nullable(),
  due_date: z.date().nullable().optional(),
  time: z.string().optional().nullable(),
  origin_board: z.enum(["general", "today_high_priority", "today_medium_priority", "urgent", "completed", "overdue", "week_low_priority", "client_tasks"]).default("general"),
  current_board: z.enum(["general", "today_high_priority", "today_medium_priority", "urgent", "completed", "overdue", "week_low_priority", "client_tasks"]).default("general"),
  is_priority: z.boolean().default(false),
  client_name: z.string().nullable().optional(),
  parent_task_id: z.string().nullable().optional(),
  selected_tag_ids: z.array(z.string()).optional(),
});

export type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskFormProps {
  initialData?: Partial<TaskFormValues & Task> & { id?: string };
  onTaskSaved: () => void;
  onClose: () => void;
  initialOriginBoard?: TaskOriginBoard;
  initialDueDate?: Date;
  parentTaskId?: string;
}

const TaskForm: React.FC<TaskFormProps> = ({ initialData, onTaskSaved, onClose, initialOriginBoard, initialDueDate, parentTaskId }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || null,
      due_date: initialData?.due_date ? parseISO(initialData.due_date) : initialDueDate || null,
      time: initialData?.time || null,
      origin_board: (initialData?.origin_board || initialOriginBoard || "general") as TaskOriginBoard,
      current_board: (initialData?.current_board || initialOriginBoard || "general") as TaskOriginBoard,
      is_priority: initialData?.is_priority || false,
      client_name: initialData?.client_name || null,
      parent_task_id: initialData?.parent_task_id || parentTaskId || null,
      selected_tag_ids: initialData?.tags?.map(tag => tag.id) || [],
    },
  });

  const saveTaskMutation = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      if (!userId) throw new Error("Usuário não autenticado.");

      const dataToSave = {
        title: values.title,
        description: values.description || null,
        due_date: values.due_date ? format(convertToUtc(values.due_date)!, "yyyy-MM-dd") : null,
        time: values.time || null,
        // Campos de recorrência removidos
        origin_board: values.origin_board,
        current_board: values.current_board,
        is_priority: values.is_priority,
        client_name: values.client_name || null,
        parent_task_id: values.parent_task_id || null,
        updated_at: new Date().toISOString(),
        is_completed: false,
        completed_at: null,
        overdue: false,
      };

      let taskId: string;

      if (initialData?.id) {
        const { data, error } = await supabase
          .from("tasks")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId)
          .select("id")
          .single();

        if (error) throw error;
        taskId = data.id;
        showSuccess("Tarefa atualizada com sucesso!");
      } else {
        const { data, error } = await supabase.from("tasks").insert({
          ...dataToSave,
          user_id: userId,
          created_at: formatISO(new Date()), // Usando formatISO do utils
        }).select("id").single();

        if (error) throw error;
        taskId = data.id;
        showSuccess("Tarefa adicionada com sucesso!");
      }

      // Handle tags
      await supabase.from("task_tags").delete().eq("task_id", taskId);

      if (values.selected_tag_ids && values.selected_tag_ids.length > 0) {
        const taskTagsToInsert = values.selected_tag_ids.map(tagId => ({
          task_id: taskId,
          tag_id: tagId,
        }));
        const { error: tagInsertError } = await supabase.from("task_tags").insert(taskTagsToInsert);
        if (tagInsertError) throw tagInsertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", userId] });
      queryClient.invalidateQueries({ queryKey: ["allTasks", userId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks", userId] });
      onTaskSaved();
      onClose();
    },
    onError: (error: any) => {
      showError("Erro ao salvar tarefa: " + error.message);
      console.error("Erro ao salvar tarefa:", error);
    },
  });

  const onSubmit = (values: TaskFormValues) => {
    saveTaskMutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl card-hover-effect">
        <TaskBasicInfo form={form} />

        <FormField
          control={form.control}
          name="due_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-foreground">Data de Vencimento (Opcional)</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                      {field.value ? (
                        formatDateTime(field.value, false) // Usando formatDateTime
                      ) : (
                        <span>Escolha uma data</span>
                      )}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
                  <Calendar
                    mode="single"
                    selected={field.value || undefined}
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
          name="time"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground">Horário (Opcional)</FormLabel>
              <FormControl>
                <TimePicker
                  value={field.value || null}
                  onChange={(time) => field.onChange(time || null)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <TaskCategorization form={form} />

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={saveTaskMutation.isPending}>
          {saveTaskMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (initialData?.id ? "Atualizar Tarefa" : "Adicionar Tarefa")}
        </Button>
      </form>
    </Form>
  );
};

export default TaskForm;