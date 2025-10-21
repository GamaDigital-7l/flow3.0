"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { Task, TaskRecurrenceType, TaskOriginBoard, TaskCurrentBoard } from "@/types/task";
import { Form } from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

import TaskBasicInfo from "./task/TaskBasicInfo";
import TaskScheduling from "./task/TaskScheduling";
import TaskRecurrence from "./task/TaskRecurrence";
import TaskCategorization from "./task/TaskCategorization";

const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "O título da tarefa é obrigatório."),
  description: z.string().optional(),
  due_date: z.date().optional().nullable(),
  time: z.string().optional().nullable(),
  recurrence_type: z.enum(["none", "daily", "weekly", "monthly", "yearly"]).default("none"),
  recurrence_details: z.string().optional().nullable(),
  recurrence_time: z.string().optional().nullable(),
  origin_board: z.enum(["general", "today_high_priority", "today_medium_priority", "urgent", "completed", "recurring", "overdue", "week_low_priority", "client_tasks"]).default("general"),
  current_board: z.enum(["general", "today_high_priority", "today_medium_priority", "urgent", "completed", "recurring", "overdue", "week_low_priority", "client_tasks"]).default("general"),
  is_priority: z.boolean().default(false),
  selected_tag_ids: z.array(z.string()).optional(),
  parent_task_id: z.string().nullable().optional(),
  client_name: z.string().nullable().optional(),
  is_daily_recurring: z.boolean().default(false),
});

export type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskFormProps {
  initialData?: Partial<TaskFormValues> & { id?: string; tags?: { id: string; name: string; color: string }[] };
  onTaskSaved: () => void;
  onClose?: () => void;
  initialOriginBoard?: TaskOriginBoard;
  initialDueDate?: Date;
}

const TaskForm: React.FC<TaskFormProps> = ({ initialData, onTaskSaved, onClose, initialOriginBoard, initialDueDate }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      due_date: initialData?.due_date || initialDueDate || undefined,
      time: initialData?.time || undefined,
      recurrence_type: initialData?.recurrence_type || "none",
      recurrence_details: initialData?.recurrence_details || undefined,
      recurrence_time: initialData?.recurrence_time || undefined,
      origin_board: initialData?.origin_board || initialOriginBoard || "general",
      current_board: initialData?.current_board || initialOriginBoard || "general",
      is_priority: initialData?.is_priority || initialOriginBoard === "today_high_priority",
      selected_tag_ids: initialData?.tags?.map(tag => tag.id) || [],
      parent_task_id: initialData?.parent_task_id || null,
      client_name: initialData?.client_name || null,
      is_daily_recurring: initialData?.is_daily_recurring || false,
    },
  });

  const onSubmit = async (values: TaskFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      let taskId: string;

      const finalRecurrenceType = values.is_daily_recurring ? "daily" : values.recurrence_type;
      const finalCurrentBoard = values.is_daily_recurring ? "recurring" : values.current_board;
      const finalOriginBoard = values.is_daily_recurring ? "recurring" : values.origin_board;

      const dataToSave = {
        title: values.title,
        description: values.description || null,
        due_date: values.due_date ? format(values.due_date, "yyyy-MM-dd") : null,
        time: values.time || null,
        recurrence_type: finalRecurrenceType,
        recurrence_details: values.recurrence_details || null,
        recurrence_time: values.recurrence_time || null,
        origin_board: finalOriginBoard,
        current_board: finalCurrentBoard,
        is_priority: values.is_priority,
        is_completed: false,
        overdue: false,
        parent_task_id: values.parent_task_id || null,
        client_name: values.client_name || null,
        is_daily_recurring: values.is_daily_recurring,
        updated_at: new Date().toISOString(),
      };

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
        }).select("id").single();

        if (error) throw error;
        taskId = data.id;
        showSuccess("Tarefa adicionada com sucesso!");
      }

      await supabase.from("task_tags").delete().eq("task_id", taskId);

      if (values.selected_tag_ids && values.selected_tag_ids.length > 0) {
        const taskTagsToInsert = values.selected_tag_ids.map(tagId => ({
          task_id: taskId,
          tag_id: tagId,
        }));
        const { error: tagInsertError } = await supabase.from("task_tags").insert(taskTagsToInsert);
        if (tagInsertError) throw tagInsertError;
      }

      form.reset();
      onTaskSaved();
      onClose?.();
      queryClient.invalidateQueries({ queryKey: ["tasks", userId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks", userId] });
      queryClient.invalidateQueries({ queryKey: ["dailyRecurringTasks", userId] });
    } catch (error: any) {
      showError("Erro ao salvar tarefa: " + error.message);
      console.error("Erro ao salvar tarefa:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass card-hover-effect">
        <TaskBasicInfo form={form} />
        <TaskScheduling form={form} />
        <TaskRecurrence form={form} />
        <TaskCategorization form={form} />
        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
          {initialData?.id ? "Atualizar Tarefa" : "Adicionar Tarefa"}
        </Button>
      </form>
    </Form>
  );
};

export default TaskForm;