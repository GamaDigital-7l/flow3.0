import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, CalendarDays, Clock, MapPin, Link as LinkIcon, AlertCircle, Users, PlusCircle } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { Task, TaskCurrentBoard } from "@/types/task";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateTime, formatTime, parseISO } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { isToday, isTomorrow, isBefore, startOfDay, subDays } from "date-fns"; // Importando subDays

interface TaskItemProps {
  task: Task;
  refetchTasks: () => void;
  isDailyRecurringView?: boolean;
}

const getTaskStatusBadge = (status: TaskCurrentBoard, task: Task) => {
  const isTrulyOverdue = task.due_date && isBefore(parseISO(task.due_date), startOfDay(new Date())) && !task.is_completed;

  if (task.is_completed) {
    return <Badge className="bg-status-completed text-foreground/80 h-5 px-1.5 text-xs">Concluída</Badge>;
  }
  
  if (isTrulyOverdue) {
    // Se estiver atrasada, retorna apenas a badge de Atrasada
    return <Badge variant="destructive" className="bg-status-overdue text-white h-5 px-1.5 text-xs">Atrasada</Badge>;
  }

  // Se não estiver atrasada, verifica outras condições
  if (task.due_date) {
    const dueDate = parseISO(task.due_date);
    if (isToday(dueDate)) {
      return <Badge className="bg-status-today text-white h-5 px-1.5 text-xs">Hoje</Badge>;
    }
    if (isTomorrow(dueDate)) {
      return <Badge variant="secondary" className="h-5 px-1.5 text-xs">Amanhã</Badge>;
    }
  }
  
  if (task.is_priority) {
    return <Badge className="bg-status-urgent text-white h-5 px-1.5 text-xs">Prioridade</Badge>;
  }
  
  return null;
};

const getTaskDueDateDisplay = (task: Task): string => {
  if (task.due_date) {
    const dueDate = parseISO(task.due_date);
    let dateString = formatDateTime(dueDate, false);
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
  const [isSubtaskFormOpen, setIsSubtaskFormOpen] = React.useState(false); // ADD THIS LINE

  const isClientTaskMirrored = task.current_board === "client_tasks";
  const isRecurrentTemplate = task.recurrence_type !== 'none';

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { data: taskToUpdate, error: fetchTaskError } = await supabase
        .from("tasks")
        .select("recurrence_type, parent_task_id")
        .eq("id", taskId)
        .single();

      if (fetchTaskError) throw fetchTaskError;

      let newCurrentBoard = task.current_board;
      let newOverdueStatus = task.overdue;

      if (taskToUpdate.recurrence_type === "none") {
        newCurrentBoard = "completed";
        newOverdueStatus = false;
      } else {
        newCurrentBoard = 'completed'; 
        newOverdueStatus = false;
      }

      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          is_completed: true,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          current_board: newCurrentBoard,
          overdue: newOverdueStatus,
        })
        .eq("id", taskId);

      if (updateError) throw updateError;

      // Se for uma instância recorrente, atualiza o streak no template pai
      if (taskToUpdate.parent_task_id) {
        // O streak é atualizado pela Edge Function update-recurrence-streak,
        // mas para feedback imediato, podemos invalidar a query do template.
        // No entanto, a Edge Function é a fonte da verdade para o streak.
        // Apenas garantimos que a Edge Function de streak rode após a instanciação.
      }

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
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
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
          current_board: task.origin_board,
          overdue: false,
        })
        .eq("id", taskId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      showSuccess("Tarefa marcada como pendente.");
      refetchTasks();
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
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
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
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

  const isCompleted = task.is_completed;
  
  // Lógica de aviso de hábito:
  // 1. É uma instância recorrente (tem parent_task_id)
  // 2. Não está concluída
  // 3. O streak do template pai é 0 (indicando que falhou ontem)
  const isRecurrentInstance = !!task.parent_task_id;
  const streakIsBroken = task.recurrence_streak === 0;
  const shouldShowHabitWarning = isRecurrentInstance && !isCompleted && streakIsBroken;

  // Nova lógica de atraso: data de vencimento existe E é anterior ao início do dia de hoje E não está concluída
  const isTrulyOverdue = task.due_date && isBefore(parseISO(task.due_date), startOfDay(new Date())) && !isCompleted;

  return (
    <Card className={cn(
      "p-2 border border-border rounded-lg bg-card shadow-sm transition-all duration-200",
      isCompleted ? "opacity-70" : "card-hover-effect",
      isTrulyOverdue && "border-red-500 ring-1 ring-red-500/50" // Usar isTrulyOverdue
    )}>
      <div className="flex items-start gap-2">
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
          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0 mt-1 h-4 w-4"
          disabled={completeTaskMutation.isPending || uncompleteTaskMutation.isPending || isClientTaskMirrored}
        />
        <div className="grid gap-0.5 flex-grow min-w-0">
          <label
            htmlFor={`task-${task.id}`}
            className={cn(
              "font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70 break-words text-sm",
              isCompleted && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </label>
          {task.description && (
            <p className="text-xs text-muted-foreground break-words line-clamp-1">{task.description}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-0.5">
            {getTaskStatusBadge(task.current_board, task)}
            {task.tags && task.tags.length > 0 && task.tags.map((tag) => (
              <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs flex-shrink-0 h-5 px-1.5">
                {tag.name}
              </Badge>
            ))}
            {task.client_name && (
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-500 border-blue-500/50 h-5 px-1.5 text-xs">
                <Users className="h-3 w-3 mr-1" /> {task.client_name}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <CalendarDays className="h-3 w-3 flex-shrink-0" /> {getTaskDueDateDisplay(task)}
          </p>
          {shouldShowHabitWarning && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 flex-shrink-0" /> Não quebre o hábito!
            </p>
          )}
          {isTrulyOverdue && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 flex-shrink-0" /> Atenção: Tarefa Atrasada!
            </p>
          )}
        </div>
        <div className="flex-shrink-0 flex gap-0.5">
          <Button variant="ghost" size="icon" onClick={() => handleEditTask(task)} className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground">
            <Edit className="h-3.5 w-3.5" />
            <span className="sr-only">Editar Tarefa</span>
          </Button>
          {!isRecurrentTemplate && (
            <Button variant="ghost" size="icon" onClick={handleAddSubtask} className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground">
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only">Adicionar Subtarefa</span>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)} className="h-7 w-7 text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
            <Trash2 className="h-3.5 w-3.5" />
            <span className="sr-only">Deletar Tarefa</span>
          </Button>
        </div>
      </div>

      {task.subtasks && task.subtasks.length > 0 && (
        <div className="ml-5 mt-2 space-y-1 border-l pl-2">
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
              initialData={{ ...editingTask, due_date: editingTask?.due_date ? parseISO(editingTask.due_date) : undefined } as any}
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
              } as any}
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