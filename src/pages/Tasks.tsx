import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Task, TaskCurrentBoard, TaskOriginBoard, TaskRecurrenceType } from "@/types/task";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Filter, CalendarDays } from "lucide-react";
import { showError } from "@/utils/toast";
import TaskItem from "@/components/TaskItem";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { parseISO } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useLocation } from "react-router-dom";

const fetchTasks = async (userId: string, board: TaskCurrentBoard): Promise<Task[]> => {
  let query = supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, completed_at, updated_at,
      template_task_id, route_to_origin_board,
      task_tags(
        tags(id, name, color)
      ),
      subtasks:tasks!parent_task_id(
        id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
        origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, completed_at, updated_at,
        template_task_id, route_to_origin_board,
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
  } else if (board === 'overdue') {
    query = query.order("due_date", { ascending: true });
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
      template_task_id: sub.template_task_id, // Mantido
    })),
    // Ensure date fields are Date objects if needed for form/display logic
    due_date: task.due_date ? parseISO(task.due_date) : null,
    template_task_id: task.template_task_id, // Mantido
  })) || [];
  return mappedData;
};

const TASK_BOARDS: { id: TaskCurrentBoard; title: string }[] = [
  { id: "today_high_priority", title: "Hoje (Alta Prioridade)" },
  { id: "today_medium_priority", title: "Hoje (Média Prioridade)" },
  { id: "week_low_priority", title: "Esta Semana (Baixa Prioridade)" },
  { id: "general", title: "Geral" },
  { id: "recurring", title: "Recorrentes" }, // Reintroduzido
  { id: "overdue", title: "Atrasadas" },
  { id: "client_tasks", title: "Tarefas de Cliente" },
  { id: "completed", title: "Concluídas" },
];

const Tasks: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const location = useLocation();

  const [activeBoard, setActiveBoard] = useState<TaskCurrentBoard>("today_high_priority");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  const { data: tasks, isLoading, error, refetch } = useQuery<Task[], Error>({
    queryKey: ["tasks", userId, activeBoard],
    queryFn: () => fetchTasks(userId!, activeBoard),
    enabled: !!userId,
  });

  const handleTaskUpdated = () => {
    refetch();
    setIsFormOpen(false);
    setEditingTask(undefined);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleAddTask = () => {
    setEditingTask(undefined);
    setIsFormOpen(true);
  };

  const getBoardTitle = (boardId: TaskCurrentBoard) => {
    return TASK_BOARDS.find(b => b.id === boardId)?.title || boardId;
  };

  React.useEffect(() => {
    if (location.state?.openNewTaskForm) {
      handleAddTask();
    }
  }, [location.state?.openNewTaskForm]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando tarefas...
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar tarefas: " + error.message);
    return <p className="text-red-500">Erro ao carregar tarefas: {error.message}</p>;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="h-7 w-7 text-primary" /> Tarefas
        </h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
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
                initialData={editingTask ? { ...editingTask, due_date: editingTask.due_date || undefined } as any : undefined} // FIX TS2322
                onTaskSaved={handleTaskUpdated}
                onClose={() => setIsFormOpen(false)}
                initialOriginBoard={activeBoard}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
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
              <TaskItem key={task.id} task={task} refetchTasks={refetch} />
            ))
          ) : (
            <p className="text-muted-foreground">Nenhuma tarefa encontrada nesta categoria.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Tasks;