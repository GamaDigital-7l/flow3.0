"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { FormatDistanceOptions } from 'date-fns';

interface PeriodSelectorProps {
  currentPeriod: Date;
  onPeriodChange: (newPeriod: Date) => void;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({ currentPeriod, onPeriodChange }) => {
  const generateMonthOptions = () => {
    const options = [];
    const today = new Date();
    for (let i = -12; i <= 12; i++) { // 12 meses para trás e 12 meses para frente
      const date = startOfMonth(addMonths(today, i));
      options.push(date);
    }
    return options;
  };

  const handleMonthChange = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    onPeriodChange(new Date(year, month - 1, 1));
  };

  const handleShortcut = (months: number) => {
    const newDate = addMonths(new Date(), -months);
    onPeriodChange(startOfMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1)));
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-card border border-border rounded-xl shadow-sm frosted-glass">
      {/* Controles de Mês */}
      <div className="flex items-center gap-2 w-full">
        <Button variant="ghost" size="icon" onClick={() => onPeriodChange(subMonths(currentPeriod, 1))} className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-9 w-9 flex-shrink-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Select
          value={format(currentPeriod, "yyyy-MM")}
          onValueChange={handleMonthChange}
        >
          <SelectTrigger className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring h-9 text-sm">
            <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
            <SelectValue placeholder="Selecionar Mês" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            {generateMonthOptions().map((date) => {
              const value = format(date, "yyyy-MM");
              const label = format(date, "MMMM yyyy", { locale: ptBR } as FormatDistanceOptions);
              return <SelectItem key={value} value={value}>{label}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={() => onPeriodChange(addMonths(currentPeriod, 1))} className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-9 w-9 flex-shrink-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Atalhos de Período */}
      <div className="grid grid-cols-4 gap-2 w-full border-t border-border pt-2">
        <Button variant="outline" size="sm" onClick={() => onPeriodChange(new Date())} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground h-8 text-xs">Hoje</Button>
        <Button variant="outline" size="sm" onClick={() => handleShortcut(3)} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground h-8 text-xs">3m</Button>
        <Button variant="outline" size="sm" onClick={() => handleShortcut(6)} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground h-8 text-xs">6m</Button>
        <Button variant="outline" size="sm" onClick={() => handleShortcut(12)} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground h-8 text-xs">12m</Button>
      </div>
    </div>
  );
};

export default PeriodSelector;
```

```typescript
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from 'zod';
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
import { FinancialAccount, FinancialScope, FinancialTransactionType, FinancialGoal } from "@/types/finance";
import { useQueryClient } from "@tanstack/react-query";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante

const formSchema = z.object({
  name: z.string().min(1, "O nome da meta é obrigatório."),
  target_amount: z.number().min(0.01, "O valor alvo deve ser positivo."),
  current_amount: z.number().min(0, "O valor atual não pode ser negativo."),
  target_date: z.date().nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'archived']).default('pending'),
  //linked_account_id: z.string().min(1, "A conta vinculada é obrigatória."), // Required
});

export type FinancialGoalFormValues = z.infer<typeof formSchema>;

interface FinancialGoalFormProps {
  initialData?: FinancialGoal | null;
  onGoalSaved: () => void;
  onClose: () => void;
}

const FinancialGoalForm: React.FC<FinancialGoalFormProps> = ({ initialData, onGoalSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const form = useForm<FinancialGoalFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      target_amount: initialData?.target_amount || 0,
      current_amount: initialData?.current_amount || 0,
      target_date: initialData?.target_date || undefined,
      status: initialData?.status || 'pending',
    },
  });

  const onSubmit = async (values: FinancialGoalFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    const goalData = {
      name: values.name,
      target_amount: values.target_amount,
      current_amount: values.current_amount,
      status: values.status,
      user_id: userId,
      target_date: values.target_date ? format(convertToUtc(values.target_date)!, 'yyyy-MM-dd') : null,
      linked_account_id: initialData?.linked_account_id || null, // Mantendo o linked_account_id existente ou null
    };

    try {
      if (initialData?.id) {
        const { error } = await supabase
          .from("financial_goals")
          .update(goalData)
          .eq("id", initialData.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Meta atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("financial_goals")
          .insert(goalData);

        if (error) throw error;
        showSuccess("Meta registrada com sucesso!");
      }
      onGoalSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar meta: " + error.message);
      console.error("Erro ao salvar meta:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome da Meta</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Aposentadoria" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="target_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Alvo (R$)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="100000.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="current_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Atual (R$)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="target_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data Alvo (Opcional)</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                      {field.value ? formatDateTime(field.value, false) : <span>Selecione uma data</span>}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
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

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : initialData ? (
            "Salvar Alterações"
          ) : (
            "Criar Meta"
          )}
        </Button>
      </div>
    </form>
  </Form>
  );
};

export default FinancialGoalForm;
```

```typescript
"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Task, TaskCurrentBoard, TaskOriginBoard, TaskRecurrenceType, DAYS_OF_WEEK_LABELS } from "@/types/task";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Filter, CalendarDays, Repeat, Edit, Trash2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import TaskItem from "@/components/TaskItem";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { parseISO } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TASK_BOARDS: { id: TaskCurrentBoard; title: string }[] = [
  { id: "today_high_priority", title: "Hoje (Alta Prioridade)" },
  { id: "today_medium_priority", title: "Hoje (Média Prioridade)" },
  { id: "week_low_priority", title: "Esta Semana (Baixa Prioridade)" },
  { id: "general", title: "Woe Comunicação" },
  { id: "client_tasks", title: "Tarefas de Cliente" },
  { id: "completed", title: "Concluídas" },
];

const fetchTasks = async (userId: string, board: TaskCurrentBoard): Promise<Task[]> => {
  let query = supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, completed_at, updated_at,
      task_tags(
        tags(id, name, color)
      ),
      subtasks:tasks!parent_task_id(
        id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
        origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, completed_at, updated_at,
        task_tags(
          tags(id, name, color)
        )
      )
    `)
    .eq("user_id", userId)
    .eq("current_board", board)
    .is("parent_task_id", null);

  if (board === 'completed') {
    query = query.order("completed_at", { ascending: false });
  } else {
    query = query.order("is_priority", { ascending: false }).order("due_date", { ascending: true, nullsFirst: false });
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }
  const mappedData = data?.map((task: any) => ({
    ...task,
    tags: task.task_tags.map((tt: any) => tt.tags),
    subtasks: task.subtasks.map((sub: any) => ({
      ...sub,
      tags: sub.task_tags.map((t: any) => t.tags),
    })),
    // Ensure date fields are Date objects if needed for form/display logic
    due_date: task.due_date ? parseISO(task.due_date) : null,
  })) || [];
  return mappedData;
};

const getBoardTitle = (boardId: TaskOriginBoard) => {
  switch (boardId) {
    case "today_high_priority": return "Hoje (Alta Prioridade)";
    case "today_medium_priority": return "Hoje (Média Prioridade)";
    case "week_low_priority": return "Esta Semana (Baixa Prioridade)";
    case "general": return "Woe Comunicação";
    case "client_tasks": return "Tarefas de Cliente";
    case "completed": return "Concluídas";
    default: return boardId;
  }
};

const Tasks: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeBoard, setActiveBoard] = useState<TaskCurrentBoard>("today_high_priority");
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  const { data: tasks, isLoading: isLoadingTasks, error: errorTasks, refetch: refetchTasks } = useQuery<Task[], Error>({
    queryKey: ["tasks", userId, activeBoard],
    queryFn: () => fetchTasks(userId!, activeBoard),
    enabled: !!userId,
  });
  
  // Removendo o uso direto de useTodayHabits aqui, pois a página Recurrence lida com isso.
  // const { todayHabits, isLoading: isLoadingHabits, error: errorHabits, refetch: refetchHabits } = useTodayHabits(); 

  const handleTaskUpdated = () => {
    refetchTasks();
    setIsTaskFormOpen(false);
    setEditingTask(undefined);
  };
  
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const handleAddTask = () => {
    setEditingTask(undefined);
    setIsTaskFormOpen(true);
  };

  React.useEffect(() => {
    if (location.state?.openNewTaskForm) {
      handleAddTask();
    }
  }, [location.state?.openNewTaskForm]);

  if (isLoadingTasks) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando tarefas...
      </div>
    );
  }

  if (errorTasks) {
    showError("Erro ao carregar tarefas: " + errorTasks.message);
    return <p className="text-red-500">Erro ao carregar tarefas: {errorTasks.message}</p>;
  }

  return (
    <div className="page-content-wrapper">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="h-7 w-7 text-primary" /> Minhas Tarefas
        </h1>
        
        <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddTask} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}</DialogTitle>
              <DialogDescription>
                {editingTask ? "Atualize os detalhes da sua tarefa." : "Defina uma nova tarefa para o seu dia."}
              </DialogDescription>
            </DialogHeader>
            <TaskForm
                initialData={editingTask ? { ...editingTask, due_date: editingTask.due_date || undefined } as any : undefined}
                onTaskSaved={handleTaskUpdated}
                onClose={() => setIsTaskFormOpen(false)}
                initialOriginBoard={activeBoard}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 overflow-x-auto pb-2">
        <div className="flex flex-nowrap gap-2 min-w-max">
          {TASK_BOARDS.map(board => (
            <Button
              key={board.id}
              variant={activeBoard === board.id ? "default" : "outline"}
              onClick={() => setActiveBoard(board.id)}
              className="flex-shrink-0"
            >
              {board.title} ({tasks?.length || 0})
            </Button>
          ))}
        </div>
      </div>

      <Card className="bg-card border-border shadow-lg frosted-glass">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">{getBoardTitle(activeBoard)}</CardHeader>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks && tasks.length > 0 ? (
            tasks.map(task => (
              <TaskItem key={task.id} task={task} refetchTasks={refetchTasks} />
            ))
          ) : (
            <p className="text-muted-foreground">Nenhuma tarefa encontrada nesta categoria.</p>
          )}
```xml
<dyad-write path="src/pages/Tasks.tsx" description="Fixing TypeScript compile-time errors in Tasks.tsx">
"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Task, TaskCurrentBoard, TaskOriginBoard, TaskRecurrenceType, DAYS_OF_WEEK_LABELS } from "@/types/task";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Filter, CalendarDays, Repeat, Edit, Trash2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import TaskItem from "@/components/TaskItem";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { parseISO } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TASK_BOARDS: { id: TaskCurrentBoard; title: string }[] = [
  { id: "today_high_priority", title: "Hoje (Alta Prioridade)" },
  { id: "today_medium_priority", title: "Hoje (Média Prioridade)" },
  { id: "week_low_priority", title: "Esta Semana (Baixa Prioridade)" },
  { id: "general", title: "Woe Comunicação" },
  { id: "client_tasks", title: "Tarefas de Cliente" },
  { id: "completed", title: "Concluídas" },
];

const fetchTasks = async (userId: string, board: TaskCurrentBoard): Promise<Task[]> => {
  let query = supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, completed_at, updated_at,
      task_tags(
        tags(id, name, color)
      ),
      subtasks:tasks!parent_task_id(
        id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
        origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, completed_at, updated_at,
        task_tags(
          tags(id, name, color)
        )
      )
    `)
    .eq("user_id", userId)
    .eq("current_board", board)
    .is("parent_task_id", null);

  if (board === 'completed') {
    query = query.order("completed_at", { ascending: false });
  } else {
    query = query.order("is_priority", { ascending: false }).order("due_date", { ascending: true, nullsFirst: false });
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }
  const mappedData = data?.map((task: any) => ({
    ...task,
    tags: task.task_tags.map((tt: any) => tt.tags),
    subtasks: task.subtasks.map((sub: any) => ({
      ...sub,
      tags: sub.task_tags.map((t: any) => t.tags),
    })),
    // Ensure date fields are Date objects if needed for form/display logic
    due_date: task.due_date ? parseISO(task.due_date) : null,
  })) || [];
  return mappedData;
};

const getBoardTitle = (boardId: TaskOriginBoard) => {
  switch (boardId) {
    case "today_high_priority": return "Hoje (Alta Prioridade)";
    case "today_medium_priority": return "Hoje (Média Prioridade)";
    case "week_low_priority": return "Esta Semana (Baixa Prioridade)";
    case "general": return "Woe Comunicação";
    case "client_tasks": return "Tarefas de Cliente";
    case "completed": return "Concluídas";
    default: return boardId;
  }
};

const Tasks: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeBoard, setActiveBoard] = useState<TaskCurrentBoard>("today_high_priority");
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  const { data: tasks, isLoading: isLoadingTasks, error: errorTasks, refetch: refetchTasks } = useQuery<Task[], Error>({
    queryKey: ["tasks", userId, activeBoard],
    queryFn: () => fetchTasks(userId!, activeBoard),
    enabled: !!userId,
  });
  
  // Removendo o uso direto de useTodayHabits aqui, pois a página Recurrence lida com isso.
  // const { todayHabits, isLoading: isLoadingHabits, error: errorHabits, refetch: refetchHabits } = useTodayHabits(); 

  const handleTaskUpdated = () => {
    refetchTasks();
    setIsTaskFormOpen(false);
    setEditingTask(undefined);
  };
  
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const handleAddTask = () => {
    setEditingTask(undefined);
    setIsTaskFormOpen(true);
  };

  React.useEffect(() => {
    if (location.state?.openNewTaskForm) {
      handleAddTask();
    }
  }, [location.state?.openNewTaskForm]);

  if (isLoadingTasks) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando tarefas...
      </div>
    );
  }

  if (errorTasks) {
    showError("Erro ao carregar tarefas: " + errorTasks.message);
    return <p className="text-red-500">Erro ao carregar tarefas: {errorTasks.message}</p>;
  }

  return (
    <div className="page-content-wrapper">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="h-7 w-7 text-primary" /> Minhas Tarefas
        </h1>
        
        <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAddTask} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}</DialogTitle>
              <DialogDescription>
                {editingTask ? "Atualize os detalhes da sua tarefa." : "Defina uma nova tarefa para o seu dia."}
              </DialogDescription>
            </DialogHeader>
            <TaskForm
                initialData={editingTask ? { ...editingTask, due_date: editingTask.due_date || undefined } as any : undefined}
                onTaskSaved={handleTaskUpdated}
                onClose={() => setIsTaskFormOpen(false)}
                initialOriginBoard={activeBoard}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 overflow-x-auto pb-2">
        <div className="flex flex-nowrap gap-2 min-w-max">
          {TASK_BOARDS.map(board => (
            <Button
              key={board.id}
              variant={activeBoard === board.id ? "default" : "outline"}
              onClick={() => setActiveBoard(board.id)}
              className="flex-shrink-0"
            >
              {board.title} ({tasks?.length || 0})
            </Button>
          ))}
        </div>
      </div>

      <Card className="bg-card border-border shadow-lg frosted-glass">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">{getBoardTitle(activeBoard)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks && tasks.length > 0 ? (
            tasks.map(task => (
              <TaskItem key={task.id} task={task} refetchTasks={refetchTasks} />
            ))
          ) : (
            <p className="text-muted-foreground">Nenhuma tarefa encontrada nesta categoria.</p>
          )}