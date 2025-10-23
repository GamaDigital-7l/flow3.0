import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Task, TaskCurrentBoard, TaskOriginBoard, TaskRecurrenceType, DAYS_OF_WEEK_LABELS } from "@/types/task";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Filter, CalendarDays, Repeat, Edit, Trash2, ListTodo, AlertCircle, Users, CheckCircle2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import TaskItem from "@/components/TaskItem";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { parseISO } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useLocation } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QuickAddTaskInput from "@/components/dashboard/QuickAddTaskInput";

const ALL_TASK_BOARDS: { id: TaskCurrentBoard; title: string; icon: React.ReactNode }[] = [
  { id: "today_high_priority", title: "Hoje (Alta)", icon: <ListTodo className="h-4 w-4" /> },
  { id: "today_medium_priority", title: "Hoje (Média)", icon: <ListTodo className="h-4 w-4" /> },
  { id: "week_low_priority", title: "Esta Semana", icon: <CalendarDays className="h-4 w-4" /> },
  { id: "general", title: "Geral", icon: <ListTodo className="h-4 w-4" /> },
  { id: "recurring", title: "Recorrentes", icon: <Repeat className="h-4 w-4" /> },
  { id: "overdue", title: "Atrasadas", icon: <AlertCircle className="h-4 w-4" /> },
  { id: "client_tasks", title: "Clientes", icon: <Users className="h-4 w-4" /> },
  { id: "completed", title: "Concluídas", icon: <CheckCircle2 className="h-4 w-4" /> },
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
      template_task_id: null, // Removendo referência ao campo inexistente
    })),
    // Ensure date fields are Date objects if needed for form/display logic
    due_date: task.due_date, // Mantendo como string para consistência com o tipo Task
    template_task_id: null, // Removendo referência ao campo inexistente
  })) || [];
  return mappedData;
};

const getBoardTitle = (boardId: TaskOriginBoard) => {
  const board = ALL_TASK_BOARDS.find(b => b.id === boardId);
  return board ? board.title : boardId;
};

const Tasks: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const location = useLocation();

  const [activeBoard, setActiveBoard] = useState<TaskCurrentBoard>("today_high_priority");
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  // Query para buscar as tarefas do board ativo
  const { data: tasks, isLoading: isLoadingTasks, error: errorTasks, refetch: refetchTasks } = useQuery<Task[], Error>({
    queryKey: ["tasks", userId, activeBoard],
    queryFn: () => fetchTasks(userId!, activeBoard),
    enabled: !!userId,
  });

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
          <ListTodo className="h-7 w-7 text-primary" /> Minhas Tarefas
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
                initialData={editingTask ? { ...editingTask, due_date: editingTask.due_date ? parseISO(editingTask.due_date) : undefined } as any : undefined}
                onTaskSaved={handleTaskUpdated}
                onClose={() => setIsTaskFormOpen(false)}
                initialOriginBoard={activeBoard}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeBoard} onValueChange={(value) => setActiveBoard(value as TaskCurrentBoard)} className="w-full">
        {/* Lista de Tabs (Scrollable no mobile) */}
        <div className="mb-4 overflow-x-auto pb-2">
          <TabsList className="flex flex-nowrap gap-1 min-w-max bg-muted/50 border border-border/50">
            {ALL_TASK_BOARDS.map(board => (
              <TabsTrigger
                key={board.id}
                value={board.id}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm h-9"
              >
                {board.icon}
                {board.title}
                <span className="text-xs font-semibold ml-1">({tasks?.length || 0})</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Conteúdo das Tabs */}
        <TabsContent value={activeBoard} className="mt-0">
          <Card className="bg-card border-border shadow-lg frosted-glass">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground">{getBoardTitle(activeBoard)}</CardTitle>
              {activeBoard !== "overdue" && activeBoard !== "recurring" && activeBoard !== "completed" && (
                <div className="mt-2">
                  <QuickAddTaskInput
                    originBoard={activeBoard}
                    onTaskAdded={refetchTasks}
                    dueDate={new Date()}
                  />
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {tasks && tasks.length > 0 ? (
                tasks.map(task => (
                  <TaskItem key={task.id} task={task} refetchTasks={refetchTasks} />
                ))
              ) : (
                <p className="text-muted-foreground">Nenhuma tarefa encontrada nesta categoria.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para edição de Tarefa Comum (Mantido fora das TabsContent) */}
      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}</DialogTitle>
            <DialogDescription>
              {editingTask ? "Atualize os detalhes da sua tarefa." : "Defina uma nova tarefa para o seu dia."}
            </DialogDescription>
          </DialogHeader>
          <TaskForm
              initialData={editingTask ? { ...editingTask, due_date: editingTask.due_date ? parseISO(editingTask.due_date) : undefined } as any : undefined}
              onTaskSaved={handleTaskUpdated}
              onClose={() => setIsTaskFormOpen(false)}
              initialOriginBoard={activeBoard}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tasks;