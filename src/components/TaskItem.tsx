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
  isDailyRecurringView?: boolean; // Mantido, mas agora se refere ao board 'recurring'
}

const getTaskStatusBadge = (status: TaskCurrentBoard, task: Task) => {
  const isRecurrent = task.recurrence_type !== 'none';

  if (task.is_completed) {
    return <Badge className="bg-status-completed text-foreground/80 h-5 px-1.5 text-xs">Concluída</Badge>;
  }
  
  if (isRecurrent) {
    return <Badge className="bg-status-recurring text-white h-5 px-1.5 text-xs">Recorrente</Badge>;
  }
  if (task.overdue) {
    return <Badge variant="destructive" className="bg-status-overdue text-white h-5 px-1.5 text-xs">Atrasada</Badge>;
  }
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
  const isRecurrentTemplate = task.recurrence_type !== 'none';

  if (isRecurrentTemplate) {
    return `Recorrência: ${task.recurrence_type} ${task.recurrence_time ? `às ${formatTime(task.recurrence_time)}` : ''}`;
  }
  
  if (task.due_date) {
    const dueDate = parseISO(task.due_date);
    let dateString = formatDateTime(dueDate, false); // Usando formatDateTime
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
  const isRecurrentTemplate = task.recurrence_type !== 'none';

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      // Simplificando a query de fetch, pois template_task_id foi removido
      const { data: taskToUpdate, error: fetchTaskError } = await supabase
        .from("tasks")
        .select("recurrence_type")
        .eq("id", taskId)
        .single();

      if (fetchTaskError) throw fetchTaskError;

      let newCurrentBoard = task.current_board;
      let newOverdueStatus = task.overdue;

      if (taskToUpdate.recurrence_type === "none") {
        newCurrentBoard = "completed";
        newOverdueStatus = false;
      } else {
        // Se for recorrente, ela é marcada como concluída e permanece no board 'recurring'
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
          current_board: task.origin_board, // Volta para o board de origem
          overdue: false, // Remove overdue ao reverter
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

  // Usamos is_completed diretamente
  const isCompleted = task.is_completed; 

  return (
    <Card className={cn(
      "p-2 border border-border rounded-lg bg-card shadow-sm transition-all duration-200", // Reduzido p-3 para p-2 e rounded-xl para rounded-lg
      isCompleted ? "opacity-70" : "card-hover-effect",
      task.overdue && !isCompleted && "border-red-500 ring-1 ring-red-500/50"
    )}>
      <div className="flex items-start gap-2"> {/* Reduzido gap-3 para gap-2 */}
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
          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0 mt-1 h-4 w-4" // Reduzido tamanho do checkbox
          disabled={completeTaskMutation.isPending || uncompleteTaskMutation.isPending || isClientTaskMirrored}
        />
        <div className="grid gap-0.5 flex-grow min-w-0"> {/* Reduzido gap-1 para gap-0.5 */}
          <label
            htmlFor={`task-${task.id}`}
            className={cn(
              "font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70 break-words text-sm", // Reduzido para text-sm e leading-tight
              isCompleted && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </label>
          {task.description && (
            <p className="text-xs text-muted-foreground break-words line-clamp-1">{task.description}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-0.5"> {/* Reduzido mt-1 para mt-0.5 */}
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
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"> {/* Reduzido mt-1 para mt-0.5 */}
            <CalendarDays className="h-3 w-3 flex-shrink-0" /> {getTaskDueDateDisplay(task)}
          </p>
        </div>
        <div className="flex-shrink-0 flex gap-0.5"> {/* Reduzido gap-1 para gap-0.5 */}
          <Button variant="ghost" size="icon" onClick={() => handleEditTask(task)} className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground"> {/* Reduzido h-7 w-7 */}
            <Edit className="h-3.5 w-3.5" /> {/* Reduzido h-4 w-4 */}
            <span className="sr-only">Editar Tarefa</span>
          </Button>
          {!isRecurrentTemplate && ( // Não permite subtarefas em templates
            <Button variant="ghost" size="icon" onClick={handleAddSubtask} className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground"> {/* Reduzido h-7 w-7 */}
              <PlusCircle className="h-3.5 w-3.5" /> {/* Reduzido h-4 w-4 */}
              <span className="sr-only">Adicionar Subtarefa</span>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)} className="h-7 w-7 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"> {/* Reduzido h-7 w-7 */}
            <Trash2 className="h-3.5 w-3.5" /> {/* Reduzido h-4 w-4 */}
            <span className="sr-only">Deletar Tarefa</span>
          </Button>
        </div>
      </div>

      {task.subtasks && task.subtasks.length > 0 && (
        <div className="ml-5 mt-2 space-y-1 border-l pl-2"> {/* Reduzido ml-6 para ml-5, mt-3 para mt-2, space-y-2 para space-y-1, pl-3 para pl-2 */}
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