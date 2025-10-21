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
import TaskForm, { TaskFormValues } from "./TaskForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { formatDateTime, formatTime, parseISO } from "@/lib/utils";

interface TaskItemProps {
  task: Task;
  refetchTasks: () => void;
  isDailyRecurringView?: boolean; // Novo prop para a view de recorrentes diárias
}

const getTaskStatusBadge = (status: TaskCurrentBoard, task: Task) => {
  if (task.is_completed) {
    return <Badge className="bg-status-completed text-foreground/80">Concluída</Badge>;
  }
  if (task.is_daily_recurring) {
    return <Badge className="bg-status-recurring text-white">Recorrente Diária</Badge>;
  }
  if (task.overdue) {
    return <Badge variant="destructive" className="bg-status-overdue text-white">Atrasada</Badge>;
  }
  if (task.due_date) {
    const dueDate = parseISO(task.due_date);
    if (isToday(dueDate)) {
      return <Badge className="bg-status-today text-white">Hoje</Badge>;
    }
    if (isTomorrow(dueDate)) {
      return <Badge variant="secondary">Amanhã</Badge>;
    }
  }
  if (task.is_priority) {
    return <Badge className="bg-status-urgent text-white">Prioridade</Badge>;
  }
  return null;
};

const getTaskDueDateDisplay = (task: Task): string => {
  if (task.is_daily_recurring) {
    return task.recurrence_time ? `Diariamente às ${formatTime(task.recurrence_time)}` : "Diariamente";
  }
  if (task.due_date) {
    const dueDate = parseISO(task.due_date);
    let dateString = format(dueDate, "PPP"); // FIX TS2554
    if (task.time) {
      dateString += ` às ${formatTime(task.time)}`;
    }
    return dateString;
  }
  return "Sem Vencimento";
};

const TaskItem: React.FC<TaskItemProps> = ({ task, refetchTasks, isDailyRecurringView = false }) => {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | undefined>(undefined);
  const [isSubtaskFormOpen, setIsSubtaskFormOpen] = React.useState(false);

  const isClientTaskMirrored = task.current_board === "client_tasks";

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { data: taskToUpdate, error: fetchTaskError } = await supabase
        .from("tasks")
        .select("recurrence_type, is_daily_recurring, recurrence_streak, recurrence_failure_history")
        .eq("id", taskId)
        .single();

      if (fetchTaskError) throw fetchTaskError;

      const isDailyRecurrent = taskToUpdate.is_daily_recurring;
      const todayISO = format(new Date(), 'yyyy-MM-dd');

      let newStreak = taskToUpdate.recurrence_streak;
      let newFailureHistory = taskToUpdate.recurrence_failure_history;
      let lastCompletionDate = todayISO;
      let newCurrentBoard = task.current_board;
      let newOverdueStatus = task.overdue;

      if (isDailyRecurrent) {
        newStreak = (taskToUpdate.recurrence_streak || 0) + 1;
        newFailureHistory = taskToUpdate.recurrence_failure_history?.filter(d => d !== todayISO) || [];
      } else if (taskToUpdate.recurrence_type === "none") {
        newCurrentBoard = "completed";
        newOverdueStatus = false;
      }

      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          is_completed: true,
          updated_at: new Date().toISOString(),
          last_successful_completion_date: lastCompletionDate,
          completed_at: new Date().toISOString(),
          current_board: newCurrentBoard,
          overdue: newOverdueStatus,
          recurrence_streak: newStreak,
          last_completion_date: lastCompletionDate,
          recurrence_failure_history: newFailureHistory,
        })
        .eq("id", taskId);

      if (updateError) throw updateError;

      // Lógica de pontos (simplificada)
      const { data: profileData, error: fetchProfileError } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", task.user_id)
        .single();

      let currentPoints = 0;
      if (profileData) {
        currentPoints = profileData.points || 0;
      }

      const newPoints = currentPoints + 10;
      await supabase
        .from("profiles")
        .update({ points: newPoints, updated_at: new Date().toISOString() })
        .eq("id", task.user_id);
    },
    onSuccess: () => {
      showSuccess("Tarefa concluída com sucesso!");
      refetchTasks();
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
      queryClient.invalidateQueries({ queryKey: ["dailyRecurringTasks"] });
    },
    onError: (err: any) => {
      showError("Erro ao concluir tarefa: " + err.message);
    },
  });

  const uncompleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          is_completed: false,
          updated_at: new Date().toISOString(),
          completed_at: null,
          // Para recorrentes diárias, o streak será corrigido pelo daily-reset se a data de conclusão for anterior a hoje.
          // Por enquanto, apenas removemos o status de conclusão.
        })
        .eq("id", taskId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      showSuccess("Tarefa marcada como pendente.");
      refetchTasks();
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
      queryClient.invalidateQueries({ queryKey: ["dailyRecurringTasks"] });
    },
    onError: (err: any) => {
      showError("Erro ao reverter conclusão: " + err.message);
    },
  });

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm("Tem certeza que deseja deletar esta tarefa?")) {
      try {
        await supabase.from("task_tags").delete().eq("task_id", taskId);

        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", taskId);

        if (error) throw error;
        showSuccess("Tarefa deletada com sucesso!");
        refetchTasks();
        queryClient.invalidateQueries({ queryKey: ["dashboardTasks"] });
        queryClient.invalidateQueries({ queryKey: ["allTasks"] });
        queryClient.invalidateQueries({ queryKey: ["dailyRecurringTasks"] });
      } catch (err: any) {
        showError("Erro ao deletar tarefa: " + err.message);
      }
    }
  };

  const handleEditTask = (taskToEdit: Task) => {
    setEditingTask(taskToEdit);
    setIsFormOpen(true);
  };

  const handleAddSubtask = () => {
    setEditingTask(undefined);
    setIsSubtaskFormOpen(true);
  };

  const isCompleted = getAdjustedTaskCompletionStatus(task);

  return (
    <Card className={cn(
      "p-3 border border-border rounded-xl bg-card shadow-sm transition-all duration-200",
      isCompleted ? "opacity-70" : "card-hover-effect",
      task.overdue && !isCompleted && "border-red-500 ring-1 ring-red-500/50"
    )}>
      <div className="flex items-start gap-3">
        <Checkbox
          id={`task-${task.id}`}
          checked={isCompleted}
          onCheckedChange={(checked) => {
            if (checked) {
              completeTaskMutation.mutate(task.id);
            } else {
              uncompleteTaskMutation.mutate(task.id);
            }
          }}
          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0 mt-1"
          disabled={completeTaskMutation.isPending || uncompleteTaskMutation.isPending || isClientTaskMirrored}
        />
        <div className="grid gap-1 flex-grow min-w-0">
          <label
            htmlFor={`task-${task.id}`}
            className={cn(
              "font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 break-words text-sm md:text-base",
              isCompleted && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </label>
          {task.description && (
            <p className="text-xs text-muted-foreground break-words line-clamp-2">{task.description}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-1">
            {getTaskStatusBadge(task.current_board, task)}
            {task.tags && task.tags.length > 0 && task.tags.map((tag) => (
              <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs flex-shrink-0">
                {tag.name}
              </Badge>
            ))}
            {task.client_name && (
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-500 border-blue-500/50">
                <Users className="h-3 w-3 mr-1" /> {task.client_name}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <CalendarDays className="h-3 w-3 flex-shrink-0" /> {getTaskDueDateDisplay(task)}
          </p>
          {task.recurrence_streak !== undefined && isDailyRecurringView && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Repeat className="h-3 w-3 flex-shrink-0" /> Streak: {task.recurrence_streak} dias
            </p>
          )}
        </div>
        <div className="flex-shrink-0 flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleEditTask(task)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
            <Edit className="h-4 w-4" />
            <span className="sr-only">Editar Tarefa</span>
          </Button>
          {!isDailyRecurringView && (
            <Button variant="ghost" size="icon" onClick={handleAddSubtask} className="h-7 w-7 text-green-500 hover:bg-green-500/10">
              <PlusCircle className="h-4 w-4" />
              <span className="sr-only">Adicionar Subtarefa</span>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Deletar Tarefa</span>
          </Button>
        </div>
      </div>

      {task.subtasks && task.subtasks.length > 0 && (
        <div className="ml-6 mt-3 space-y-2 border-l pl-3">
          <p className="text-xs font-semibold text-muted-foreground">Subtarefas ({task.subtasks.length})</p>
          {task.subtasks.map(subtask => (
            <TaskItem key={subtask.id} task={subtask} refetchTasks={refetchTasks} />
          ))}
        </div>
      )}

      {isFormOpen && (
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingTask(undefined);
          }}
        >
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">Editar Tarefa</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Atualize os detalhes da sua tarefa.
              </DialogDescription>
            </DialogHeader>
            <TaskForm
              initialData={{ ...editingTask, due_date: editingTask?.due_date ? parseISO(editingTask.due_date) : undefined } as any} // FIX TS2322
              onTaskSaved={refetchTasks}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {isSubtaskFormOpen && (
        <Dialog
          open={isSubtaskFormOpen}
          onOpenChange={setIsSubtaskFormOpen}
        >
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">Adicionar Subtarefa para "{task.title}"</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Crie uma subtarefa vinculada à tarefa principal.
              </DialogDescription>
            </DialogHeader>
            <TaskForm
              initialData={{
                origin_board: task.origin_board,
                current_board: task.current_board,
                due_date: task.due_date ? parseISO(task.due_date) : undefined,
              } as any} // FIX TS2322
              parentTaskId={task.id}
              onTaskSaved={refetchTasks}
              onClose={() => setIsSubtaskFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

export default TaskItem;