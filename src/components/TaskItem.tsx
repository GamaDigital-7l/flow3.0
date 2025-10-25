import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, CalendarDays, Clock, AlertCircle, Users, PlusCircle } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { Task, TaskCurrentBoard } from "@/types/task";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateTime, formatTime, parseISO } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { isToday, isTomorrow, isBefore, startOfDay } from "date-fns";

interface TaskItemProps {
  task: Task;
  refetchTasks: () => void;
  compactMode?: boolean;
}

const getTaskStatusBadge = (status: TaskCurrentBoard, task: Task) => {
  if (task.is_completed) {
    // Cinza suave para concluído
    return <Badge className="bg-status-completed/20 text-status-completed h-5 px-1.5 text-xs">Concluída</Badge>;
  }
  
  // Se não estiver atrasada, verifica outras condições
  if (task.due_date) {
    const dueDate = parseISO(task.due_date);
    if (isToday(dueDate)) {
      // Rosa para Hoje
      return <Badge className="bg-status-today text-white h-5 px-1.5 text-xs">Hoje</Badge>;
    }
    if (isTomorrow(dueDate)) {
      // Cinza claro para Amanhã
      return <Badge variant="secondary" className="bg-muted/50 text-muted-foreground h-5 px-1.5 text-xs">Amanhã</Badge>;
    }
  }
  
  if (task.is_priority) {
    // Rosa para Prioridade
    return <Badge className="bg-status-urgent text-white h-5 px-1.5 text-xs">Prioridade</Badge>;
  }
  
  return null;
};

const TaskItem: React.FC<TaskItemProps> = React.memo(({ task, refetchTasks, compactMode = false }) => {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | undefined>(undefined);
  const [isSubtaskFormOpen, setIsSubtaskFormOpen] = useState(false);

  const isClientTaskMirrored = task.current_board === "client_tasks";
  const shouldShowHabitWarning = false; 

  // Nova lógica de atraso: data de vencimento existe E é anterior ao início do dia de hoje E não está concluída
  const isTrulyOverdue = task.due_date && isBefore(parseISO(task.due_date), startOfDay(new Date())) && !task.is_completed;

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          is_completed: true,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          current_board: "completed", // Sempre move para completed
          overdue: false,
        })
        .eq("id", taskId);

      if (updateError) throw updateError;

      // Atualização de pontos (mantida)
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

      // Atualização de pontos (mantida)
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

  const handleEditTask = React.useCallback((taskToEdit: Task) => {
    setEditingTask(taskToEdit);
    setIsFormOpen(true);
  }, []);

  const handleAddSubtask = React.useCallback(() => {
    setEditingTask(undefined);
    setIsSubtaskFormOpen(true);
  }, []);

  const isCompleted = task.is_completed;
  
  return (
    <>
      <Card className={cn(
        "border border-border rounded-lg bg-card shadow-sm transition-all duration-200",
        isCompleted ? "opacity-70" : "card-hover-effect",
        // Usando a cor primária para destaque de atraso
        isTrulyOverdue && "border-status-overdue ring-1 ring-status-overdue/50",
        compactMode ? "p-1.5" : "p-2" // Ajuste de padding
      )}>
        <div className="flex items-start gap-2">
          {/* Checkbox */}
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
            // Revertendo para usar a cor primary (rosa) no estado checked
            className={cn("border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0 mt-1", compactMode ? "h-3.5 w-3.5" : "h-4 w-4")}
            disabled={completeTaskMutation.isPending || uncompleteTaskMutation.isPending || isClientTaskMirrored}
          />
          <div className="grid gap-0.5 flex-grow min-w-0">
            <label
              htmlFor={`task-${task.id}`}
              className={cn(
                "font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70 break-words",
                isCompleted && "line-through text-muted-foreground",
                compactMode ? "text-xs" : "text-sm" // Ajuste de fonte
              )}
            >
              {task.title}
            </label>
            {task.description && (
              <p className={cn("text-muted-foreground break-words line-clamp-1", compactMode ? "text-[0.65rem]" : "text-xs")}>{task.description}</p>
            )}
            <div className="flex flex-wrap gap-1 mt-0.5">
              {getTaskStatusBadge(task.current_board, task)}
              {task.due_date && (
                <Badge variant="secondary" className="bg-muted/50 text-muted-foreground h-5 px-1.5 text-xs flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> {formatDateTime(task.due_date, false)}
                </Badge>
              )}
              {task.time && (
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 h-5 px-1.5 text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatTime(task.time)}
                </Badge>
              )}
              {task.tags && task.tags.map((tag) => (
                <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs flex-shrink-0 h-5 px-1.5">
                  {tag.name}
                </Badge>
              ))}
              {task.client_name && (
                <Badge variant="secondary" className="bg-muted/50 text-muted-foreground h-5 px-1.5 text-xs">
                  <Users className="h-3 w-3 mr-1" /> {task.client_name}
                </Badge>
              )}
            </div>
            {isTrulyOverdue && (
              <p className={cn("text-red-500 mt-1 flex items-center gap-1", compactMode ? "text-[0.65rem]" : "text-xs")}>
                <AlertCircle className={cn("flex-shrink-0", compactMode ? "h-3 w-3" : "h-3 w-3")} /> ⚠️ Tarefa Atrasada!
              </p>
            )}
          </div>
          <div className="flex-shrink-0 flex gap-0.5">
            <Button variant="ghost" size="icon" onClick={() => handleEditTask(task)} className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground">
              <Edit className="h-3.5 w-3.5" />
              <span className="sr-only">Editar Tarefa</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleAddSubtask()} className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground">
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only">Adicionar Subtarefa</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)} className="h-7 w-7 text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">Deletar Tarefa</span>
            </Button>
          </div>
        </div>

        {task.subtasks && task.subtasks.length > 0 && (
          <div className="ml-5 mt-2 space-y-1 border-l pl-2">
            <p className={cn("font-semibold text-muted-foreground", compactMode ? "text-xs" : "text-sm")}>Subtarefas ({task.subtasks.length})</p>
            {task.subtasks.map(subtask => (
              <TaskItem key={subtask.id} task={subtask} refetchTasks={refetchTasks} compactMode={compactMode} />
            ))}
          </div>
        )}
      </Card>

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
              initialData={editingTask ? { ...editingTask, due_date: editingTask.due_date || undefined } as any : undefined}
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
    </>
  );
});

export default TaskItem;