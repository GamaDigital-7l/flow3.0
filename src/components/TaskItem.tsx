import React from "react";
import { Trash2, Repeat, Clock, Edit, PlusCircle, BookOpen, Dumbbell, GraduationCap, Loader2, AlertCircle, Users, CalendarDays } from "lucide-react";
import { format, isPast, isToday, isTomorrow, isThisWeek, isThisMonth, isSameDay, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Task, TaskCurrentBoard } from "@/types/task";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import TaskForm from "./TaskForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { formatDateTime, formatTime } from "@/lib/utils"; // Importando as novas funções
import { parseISO } from 'date-fns';

interface TaskItemProps {
  task: Task;
  refetchTasks: () => void;
  isDailyRecurringView?: boolean; // Novo prop para a view de recorrentes diárias
}

const getTaskStatusBadge = (status: TaskCurrentBoard, task: Task) => {
  if (task.is_daily_recurring) {
    if (task.is_completed) {
      return <Badge className="bg-green-600 text-white">Concluída Hoje</Badge>;
    }
    if (task.recurrence_failure_history && task.recurrence_failure_history.length > 0) {
      const lastFailureDateStr = task.recurrence_failure_history[task.recurrence_failure_history.length - 1];
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      if (lastFailureDateStr === yesterday) {
        return <Badge variant="destructive" className="bg-red-600 text-white">Falhou Ontem</Badge>;
      }
    }
    return <Badge className="bg-purple-500 text-white flex items-center gap-1"><Repeat className="h-3 w-3" /> Diária</Badge>;
  }

  if (status === "client_tasks") {
    return <Badge className="bg-blue-500 text-white flex items-center gap-1"><Users className="h-3 w-3" /> Cliente</Badge>;
  }

  switch (status) {
    case "overdue":
      return (
        <Badge variant="destructive" className="bg-red-600 text-white flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> Atrasada
        </Badge>
      );
    case "today_high_priority":
      return <Badge className="bg-red-500 text-white">Hoje (Alta)</Badge>;
    case "today_medium_priority":
      return <Badge className="bg-orange-500 text-white">Hoje (Média)</Badge>;
    case "week_low_priority":
      return <Badge className="bg-yellow-600 text-white">Semana (Baixa)</Badge>;
    case "completed":
      return <Badge className="bg-green-600 text-white">Concluída</Badge>;
    case "recurring":
      return <Badge className="bg-purple-500 text-white flex items-center gap-1"><Repeat className="h-3 w-3" /> Recorrente</Badge>;
    default:
      return <Badge variant="secondary">Geral</Badge>;
  }
};

const getTaskDueDateDisplay = (task: Task): string => {
  if (task.is_daily_recurring) {
    return `Streak: ${task.recurrence_streak || 0} dias`;
  }

  if (!task.due_date) return "Sem data";

  return formatDateTime(task.due_date, false);
};

const TaskItem: React.FC<TaskItemProps> = ({ task, refetchTasks, isDailyRecurringView = false }) => {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | undefined>(undefined);

  const isClientTaskMirrored = task.current_board === "client_tasks";

  // Para recorrentes diárias, usamos o status 'is_completed' diretamente, pois o reset é feito pelo backend.
  // Para outras tarefas, usamos a lógica ajustada.
  const isCompleted = task.is_daily_recurring ? task.is_completed : getAdjustedTaskCompletionStatus(task as any);

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const userId = supabase.auth.getUser().then(res => res.data.user?.id);
      if (!userId) throw new Error("Usuário não autenticado.");

      const now = new Date().toISOString();
      const todayISO = format(new Date(), 'yyyy-MM-dd');

      let updateData: Partial<Task> = {
        is_completed: true,
        updated_at: now,
        completed_at: now,
      };

      if (task.is_daily_recurring) {
        // Lógica para streak de recorrentes diárias
        const newStreak = (task.recurrence_streak || 0) + 1;
        updateData.recurrence_streak = newStreak;
        updateData.last_completion_date = todayISO;
        updateData.recurrence_failure_history = task.recurrence_failure_history?.filter(d => d !== todayISO) || [];
      } else if (!isClientTaskMirrored && task.recurrence_type === "none") {
        // Mover tarefas não recorrentes (e não de cliente) para 'completed'
        updateData.current_board = "completed";
        updateData.overdue = false;
      } else if (isClientTaskMirrored) {
        // Tarefas de Cliente: Apenas marca como concluída no Dashboard (is_completed = true)
        updateData.current_board = "completed";
        // NÃO atualiza last_successful_completion_date ou streak
      } else if (task.recurrence_type !== "none") {
        // Tarefas recorrentes normais
        updateData.last_successful_completion_date = todayISO;
      }

      const { error: updateError } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", taskId)
        .eq("user_id", await userId);

      if (updateError) throw updateError;

      // Atualizar pontos (simplificado)
      const { data: profileData } = await supabase.from("profiles").select("points").eq("id", await userId).single();
      const newPoints = (profileData?.points || 0) + 10;
      await supabase.from("profiles").update({ points: newPoints, updated_at: now }).eq("id", await userId);
    },
    onSuccess: () => {
      showSuccess("Tarefa concluída!");
      refetchTasks();
      queryClient.invalidateQueries({ queryKey: ["profileResults"] });
    },
    onError: (err: any) => {
      showError("Erro ao concluir tarefa: " + err.message);
    },
  });

  const uncompleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const userId = supabase.auth.getUser().then(res => res.data.user?.id);
      if (!userId) throw new Error("Usuário não autenticado.");

      let updateData: Partial<Task> = {
        is_completed: false,
        updated_at: new Date().toISOString(),
        completed_at: null,
      };

      if (task.is_daily_recurring) {
        // Ao desmarcar uma tarefa diária recorrente, resetar o streak e a data de última conclusão.
        // O histórico de falhas é gerenciado pelo daily-task-processor para dias perdidos.
        updateData.recurrence_streak = 0; 
        updateData.last_completion_date = null;
        // Não há alteração no recurrence_failure_history aqui.
      } else if (!isClientTaskMirrored && task.recurrence_type === "none") {
        updateData.current_board = task.origin_board;
        if (task.due_date && isPast(new Date(task.due_date))) {
          updateData.overdue = true;
          updateData.current_board = "overdue";
        }
      } else if (isClientTaskMirrored) {
        // Tarefas de Cliente: Move de volta para o board de clientes (client_tasks)
        updateData.current_board = "client_tasks";
        // NÃO altera last_successful_completion_date ou streak
      } else if (task.recurrence_type !== "none") {
        // Tarefas recorrentes normais
        updateData.last_successful_completion_date = null; // Limpar para que possa ser concluída novamente no ciclo
      }

      const { error: updateError } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", taskId)
        .eq("user_id", await userId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      showSuccess("Tarefa desmarcada como concluída.");
      refetchTasks();
    },
    onError: (err: any) => {
      showError("Erro ao desmarcar tarefa: " + err.message);
    },
  });

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm("Tem certeza que deseja deletar esta tarefa e todas as suas subtarefas?")) return;
    try {
      const userId = supabase.auth.getUser().then(res => res.data.user?.id);
      if (!userId) throw new Error("Usuário não autenticado.");

      await supabase.from("task_tags").delete().eq("task_id", taskId);

      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId)
        .eq("user_id", await userId);

      if (error) throw error;
      showSuccess("Tarefa deletada com sucesso!");
      refetchTasks();
    } catch (err: any) {
      showError("Erro ao deletar tarefa: " + err.message);
      console.error("Erro ao deletar tarefa:", err);
    }
  };

  const handleEditTask = () => {
    setIsFormOpen(true);
  };

  const handleToggleComplete = (checked: boolean) => {
    if (checked) {
      completeTaskMutation.mutate(task.id);
    } else {
      uncompleteTaskMutation.mutate(task.id);
    }
  };

  const renderSubtasks = (subtasks: Task[]) => (
    <div className="mt-2 ml-4 border-l border-border pl-3 space-y-2">
      {subtasks.map(subtask => (
        <TaskItem key={subtask.id} task={subtask} refetchTasks={refetchTasks} />
      ))}
    </div>
  );

  return (
    <Card className={cn(
      "flex flex-col p-2 border border-border rounded-xl shadow-sm transition-all duration-200",
      isCompleted ? "bg-muted/30 border-green-500/50" : task.overdue ? "bg-red-900/20 border-red-500/50" : "bg-card hover:shadow-md"
    )}>
      <div className="flex items-start gap-2">
        <Checkbox
          id={`task-${task.id}`}
          checked={isCompleted}
          onCheckedChange={handleToggleComplete}
          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0 mt-1 h-4 w-4"
          disabled={completeTaskMutation.isPending || uncompleteTaskMutation.isPending}
        />
        <div className="flex-grow min-w-0">
          <label
            htmlFor={`task-${task.id}`}
            className={cn(
              "font-semibold leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70 break-words line-clamp-1",
              isCompleted ? "line-through text-muted-foreground" : "text-foreground",
              "text-sm"
            )}
          >
            {task.title}
          </label>
          {task.description && (
            <p className="text-xs md:text-sm text-muted-foreground break-words line-clamp-1 mt-0.5">
              {task.description}
            </p>
          )}
          <div className="flex flex-wrap gap-1 mt-1">
            {getTaskStatusBadge(task.current_board, task)}
            {task.recurrence_type !== "none" && !task.is_daily_recurring && (
              <Badge variant="secondary" className="bg-purple-500 text-white flex items-center gap-1 h-5 px-1.5 text-xs">
                <Repeat className="h-3 w-3" /> Recorrente
              </Badge>
            )}
            {task.tags && task.tags.length > 0 && (
              task.tags.map((tag) => (
                <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs flex-shrink-0 h-5 px-1.5">
                  {tag.name}
                </Badge>
              ))
            )}
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-1">
            <p className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" /> {formatTime(task.time)}
            </p>
            <p className="flex items-center gap-0.5">
              <CalendarDays className="h-3 w-3" /> {getTaskDueDateDisplay(task)}
            </p>
            {task.client_name && (
              <p className="text-xs text-muted-foreground">Cliente: {task.client_name}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={handleEditTask} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
            <Edit className="h-4 w-4" />
            <span className="sr-only">Editar Tarefa</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Deletar Tarefa</span>
          </Button>
          {!task.parent_task_id && (
            <Button variant="ghost" size="icon" onClick={() => setIsSubtaskFormOpen(true)} className="h-7 w-7 text-green-500 hover:bg-green-500/10">
              <PlusCircle className="h-4 w-4" />
              <span className="sr-only">Adicionar Subtarefa</span>
            </Button>
          )}
        </div>
      </div>

      {task.subtasks && task.subtasks.length > 0 && renderSubtasks(task.subtasks)}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar Tarefa</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Atualize os detalhes da sua tarefa.
            </DialogDescription>
          </DialogHeader>
          <TaskForm
            initialData={{ ...task, due_date: task.due_date ? parseISO(task.due_date) : undefined } as any}
            onTaskSaved={() => {
              setIsFormOpen(false);
              refetchTasks();
            }}
            onClose={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TaskItem;