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
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import TagSelector from "./TagSelector";
import TimePicker from "./TimePicker";
import { ptBR } from "date-fns/locale/pt-BR";
import { TaskRecurrenceType, TaskOriginBoard, Task } from "@/types/task";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

// Tipos simplificados para evitar dependência de '@/types/client'
interface Client {
  id: string;
  name: string;
}

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

const fetchClients = async (userId: string) => {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
};

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
  
  const selectedTagIds = form.watch("selected_tag_ids") || [];

  const { data: clients, isLoading: isLoadingClients } = useQuery<Client[], Error>({
    queryKey: ["clientsList", userId],
    queryFn: () => fetchClients(userId!),
    enabled: !!userId,
  });

  const saveTaskMutation = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      if (!userId) throw new Error("Usuário não autenticado.");

      // --- Lógica de Sincronização de Board e Prioridade ---
      let finalCurrentBoard = values.current_board;
      const isPriority = values.is_priority;
      const dueDate = values.due_date;
      const today = new Date();

      if (isPriority) {
        // Se for prioridade, move para o board de alta prioridade de hoje
        finalCurrentBoard = "today_high_priority";
      } else if (dueDate) {
        // Se tiver data de vencimento, mas não for prioridade, move para o board de média prioridade de hoje ou semana baixa
        if (isSameDay(dueDate, today)) {
          finalCurrentBoard = "today_medium_priority";
        } else if (dueDate > today) {
          // Se for no futuro, move para o board de baixa prioridade da semana
          finalCurrentBoard = "week_low_priority";
        } else {
          // Se a data for passada, a Edge Function ou o fetch de overdue cuidará disso, mas mantemos o board original
          finalCurrentBoard = values.origin_board;
        }
      } else {
        // Se não for prioridade e não tiver data, volta para o board de origem (geral/client_tasks)
        finalCurrentBoard = values.origin_board;
      }
      // -----------------------------------------------------

      const dataToSave = {
        title: values.title,
        description: values.description || null,
        due_date: values.due_date ? format(convertToUtc(values.due_date)!, "yyyy-MM-dd") : null,
        time: values.time || null,
        origin_board: values.origin_board,
        current_board: finalCurrentBoard, // Usando o board calculado
        is_priority: isPriority,
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
      queryClient.invalidateQueries({ queryKey: ["overdueTasks", userId] }); // Invalida o lembrete de atrasadas
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
  
  const handleTagSelectionChange = (newSelectedTagIds: string[]) => {
    form.setValue("selected_tag_ids", newSelectedTagIds, { shouldDirty: true });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl card-hover-effect">
        
        {/* --- TaskBasicInfo Content --- */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground">Título</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: Terminar relatório"
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
                  placeholder="Detalhes da tarefa..."
                  className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* --- End TaskBasicInfo Content --- */}

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

        {/* --- TaskCategorization Content --- */}
        <FormField
          control={form.control}
          name="origin_board"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground">Quadro de Origem</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
                    <SelectValue placeholder="Selecionar quadro" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                  <SelectItem value="general">Geral</SelectItem>
                  <SelectItem value="today_high_priority">Hoje - Prioridade Alta</SelectItem>
                  <SelectItem value="today_medium_priority">Hoje - Prioridade Média</SelectItem>
                  <SelectItem value="week_low_priority">Semana - Baixa</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_priority"
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
                  Prioridade Alta (Aparece no quadro "Hoje - Prioridade Alta")
                </FormLabel>
                <FormDescription className="text-muted-foreground">
                  Marque se esta tarefa for crucial para o dia.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="client_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground">Cliente (Opcional)</FormLabel>
              <Select onValueChange={(value) => field.onChange(value === '__none__' ? null : value)} value={field.value || '__none__'} disabled={isLoadingClients}>
                <FormControl>
                  <SelectTrigger className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
                    {isLoadingClients ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" /> Carregando clientes...
                      </div>
                    ) : (
                      <SelectValue placeholder="Selecionar cliente" />
                    )}
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {clients?.map(client => (
                    <SelectItem key={client.id} value={client.name}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <TagSelector
          selectedTagIds={selectedTagIds}
          onTagSelectionChange={handleTagSelectionChange}
        />
        {/* --- End TaskCategorization Content --- */}

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={saveTaskMutation.isPending}>
          {saveTaskMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (initialData?.id ? "Atualizar Tarefa" : "Adicionar Tarefa")}
        </Button>
      </form>
    </Form>
  );
};

export default TaskForm;