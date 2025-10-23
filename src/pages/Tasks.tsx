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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { parseISO } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HabitListBoard from "@/components/dashboard/HabitListBoard"; // Importar HabitListBoard
import { useTodayHabits } from "@/hooks/useHabits"; // Importar hook de hábitos
import HabitItem from "@/components/HabitItem"; // Importar HabitItem

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
      id, title, description, due_date, time, is_completed, 
      origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, completed_at, updated_at,
      task_tags(
        tags(id, name, color)
      ),
      subtasks:tasks!parent_task_id(
        id, title, description, due_date, time, is_completed, 
        origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, completed_at, updated_at,
        task_tags(
          tags(id, name, color)
        )
      )
    `)
    .eq("user_id", userId)
    .eq("current_board", board)
    .is("parent_task_id", null); // Apenas tarefas raiz

  if (board === 'completed') {
    query = query.order("completed_at", { ascending: false });
  } else {
    // Ordenação otimizada: prioridade > data de vencimento > data de criação
    query = query
      .order("is_priority", { ascending: false })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
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

// Definindo um tipo de união para as abas, incluindo 'recurrence'
type TaskTab = TaskCurrentBoard | "recurrence";

const Tasks: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeBoard, setActiveBoard] = useState<TaskTab>("today_high_priority");
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  const { data: tasks, isLoading: isLoadingTasks, error: errorTasks, refetch: refetchTasks } = useQuery<Task[], Error>({
    queryKey: ["tasks", userId, activeBoard],
    queryFn: () => fetchTasks(userId!, activeBoard as TaskCurrentBoard),
    enabled: !!userId && activeBoard !== "recurrence",
    staleTime: 1000 * 60 * 1, // 1 minuto de cache
  });
  
  const { todayHabits, isLoading: isLoadingHabits, error: errorHabits, refetch: refetchHabits } = useTodayHabits(); // Usando o novo hook

  const handleTaskUpdated = () => {
    refetchTasks();
    setIsTaskFormOpen(false);
    setEditingTask(undefined);
  };
  
  const handleHabitUpdated = () => {
    refetchHabits();
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskFormOpen(true); // Corrigido: setIsFormOpen -> setIsTaskFormOpen
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

  if (isLoadingTasks || isLoadingHabits) {
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
  
  if (errorHabits) {
    showError("Erro ao carregar hábitos: " + errorHabits.message);
    // Não retorna erro total, apenas exibe a mensagem
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
                initialOriginBoard={activeBoard as TaskOriginBoard}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 overflow-x-auto pb-2">
        <div className="flex flex-nowrap gap-2 min-w-max">
          {/* Adicionando a aba de Hábitos Recorrentes */}
          <Button
            variant={activeBoard === "recurrence" ? "default" : "outline"}
            onClick={() => setActiveBoard("recurrence")}
            className="flex-shrink-0"
          >
            <Repeat className="mr-2 h-4 w-4" /> Recorrentes ({todayHabits?.length || 0})
          </Button>
          
          {TASK_BOARDS.map(board => (
            <Button
              key={board.id}
              variant={activeBoard === board.id ? "default" : "outline"}
              onClick={() => setActiveBoard(board.id)}
              className="flex-shrink-0"
            >
              {board.title} ({activeBoard === board.id ? (tasks?.length || 0) : 0})
            </Button>
          ))}
        </div>
      </div>

      {/* Conteúdo da Aba de Hábitos */}
      {activeBoard === "recurrence" ? (
        <Card className="bg-card border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Repeat className="h-5 w-5 text-status-recurring" /> Hábitos Recorrentes de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayHabits && todayHabits.length > 0 ? (
              todayHabits.map(habit => (
                <HabitItem key={habit.id} habit={habit} refetchHabits={handleHabitUpdated} showActions={true} />
              ))
            ) : (
              <p className="text-muted-foreground">Nenhum hábito ativo para hoje. <a href="/recurrence" className="text-primary underline">Crie um novo hábito</a>.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground">{getBoardTitle(activeBoard as TaskOriginBoard)}</CardTitle>
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
      )}

      {/* Dialog para edição de Tarefa Comum */}
      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
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
              initialOriginBoard={activeBoard as TaskOriginBoard}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tasks;