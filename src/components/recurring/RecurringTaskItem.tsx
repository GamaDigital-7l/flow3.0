"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, CalendarDays, Clock, AlertCircle, Repeat, CheckCircle2, Undo2 } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { RecurringTask } from "@/types/task";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateTime, formatTime, parseISO } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import RecurringTaskForm from "./RecurringTaskForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { format } from "date-fns";

interface RecurringTaskItemProps {
  task: RecurringTask;
  refetchTasks: () => void;
  isTemplateView?: boolean; // Se for true, exibe o template, não a instância do dia
}

const RecurringTaskItem: React.FC<RecurringTaskItemProps> = ({ task, refetchTasks, isTemplateView = false }) => {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const userId = session?.user?.id;

  const [isFormOpen, setIsFormOpen] = React.useState(false);

  const isCompleted = task.completed_today;
  const isAlert = task.alert;

  const handleToggleCompletion = useMutation({
    mutationFn: async (isCompleting: boolean) => {
      if (!userId) throw new Error("Usuário não autenticado.");

      const todayLocal = task.date_local;
      const recurrenceId = task.recurrence_id;

      // 1. Atualizar a instância atual (completed_today)
      const { error: updateInstanceError } = await supabase
        .from("recurring_tasks")
        .update({
          completed_today: isCompleting,
          alert: false, // Remove o alerta ao interagir
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id)
        .eq("user_id", userId);

      if (updateInstanceError) throw updateInstanceError;

      // 2. Chamar a função RPC para atualizar métricas e criar a próxima instância
      const { error: rpcError } = await supabase.rpc('update_recurring_metrics', {
        p_recurrence_id: recurrenceId,
        p_user_id: userId,
        p_date_local: todayLocal,
        p_is_completing: isCompleting,
      });

      if (rpcError) throw rpcError;
    },
    onSuccess: (_, isCompleting) => {
      showSuccess(`Hábito ${isCompleting ? 'concluído' : 'revertido'} com sucesso!`);
      refetchTasks();
      queryClient.invalidateQueries({ queryKey: ["dashboardRecurringTasks", userId] });
      queryClient.invalidateQueries({ queryKey: ["recurringTemplates", userId] });
    },
    onError: (err: any) => {
      showError("Erro ao atualizar hábito: " + err.message);
    },
  });

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm("Tem certeza que deseja deletar este hábito e todo o seu histórico?")) {
      try {
        // Deleta o template, o que deve cascatear para todas as instâncias e histórico
        const { error } = await supabase
          .from("recurring_tasks")
          .delete()
          .eq("recurrence_id", task.recurrence_id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Hábito deletado permanentemente!");
        refetchTasks();
        queryClient.invalidateQueries({ queryKey: ["dashboardRecurringTasks", userId] });
        queryClient.invalidateQueries({ queryKey: ["recurringTemplates", userId] });
      } catch (err: any) {
        showError("Erro ao deletar hábito: " + err.message);
      }
    }
  };

  const handleEditTask = () => {
    setIsFormOpen(true);
  };

  const handlePauseToggle = useMutation({
    mutationFn: async (newPausedState: boolean) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      
      // Atualiza o template (onde id == recurrence_id)
      const { error } = await supabase
        .from("recurring_tasks")
        .update({ paused: newPausedState, updated_at: new Date().toISOString() })
        .eq("id", task.recurrence_id)
        .eq("recurrence_id", task.recurrence_id)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: (_, newPausedState) => {
      showSuccess(`Hábito ${newPausedState ? 'pausado' : 'retomado'} com sucesso!`);
      refetchTasks();
      queryClient.invalidateQueries({ queryKey: ["dashboardRecurringTasks", userId] });
      queryClient.invalidateQueries({ queryKey: ["recurringTemplates", userId] });
    },
    onError: (err: any) => {
      showError("Erro ao pausar/retomar hábito: " + err.message);
    },
  });

  const renderStatusBadge = () => {
    if (task.paused) {
      return <Badge variant="secondary" className="bg-muted/50 text-muted-foreground h-5 px-1.5 text-xs">Pausado</Badge>;
    }
    if (isCompleted) {
      return <Badge className="bg-green-500 text-white h-5 px-1.5 text-xs">Concluído Hoje</Badge>;
    }
    if (isAlert) {
      return <Badge variant="destructive" className="bg-red-500 text-white h-5 px-1.5 text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Alerta</Badge>;
    }
    return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500 h-5 px-1.5 text-xs">Pendente</Badge>;
  };

  return (
    <Card className={cn(
      "p-2 border border-border rounded-lg bg-card shadow-sm transition-all duration-200",
      isCompleted ? "opacity-80" : "card-hover-effect",
      isAlert && "border-red-500 ring-1 ring-red-500/50"
    )}>
      <div className="flex items-start gap-2">
        {/* Checkbox/Status */}
        <div className="flex-shrink-0 mt-1">
          {isTemplateView ? (
            <Repeat className="h-4 w-4 text-orange-500" />
          ) : (
            <Checkbox
              id={`habit-${task.id}`}
              checked={isCompleted}
              onCheckedChange={(checked) => handleToggleCompletion.mutate(checked as boolean)}
              className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-4 w-4"
              disabled={handleToggleCompletion.isPending || task.paused}
            />
          )}
        </div>
        
        <div className="grid gap-0.5 flex-grow min-w-0">
          <label
            htmlFor={`habit-${task.id}`}
            className={cn(
              "font-medium leading-tight break-words text-sm",
              isCompleted && !isTemplateView && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </label>
          {task.description && (
            <p className="text-xs text-muted-foreground break-words line-clamp-1">{task.description}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-0.5">
            {renderStatusBadge()}
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-500 h-5 px-1.5 text-xs">
              Streak: {task.streak}
            </Badge>
          </div>
          
          {!isTemplateView && isAlert && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 flex-shrink-0" /> Não quebre o hábito 2 dias seguidos!
            </p>
          )}
          
          {!isTemplateView && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <CalendarDays className="h-3 w-3 flex-shrink-0" /> Para: {format(parseISO(task.date_local), "PPP", { locale: ptBR })}
            </p>
          )}
        </div>
        
        <div className="flex-shrink-0 flex gap-0.5">
          {isTemplateView && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => handlePauseToggle.mutate(!task.paused)} 
              className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground"
              disabled={handlePauseToggle.isPending}
            >
              {task.paused ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Undo2 className="h-3.5 w-3.5" />}
              <span className="sr-only">{task.paused ? "Retomar" : "Pausar"}</span>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleEditTask} className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground">
            <Edit className="h-3.5 w-3.5" />
            <span className="sr-only">Editar Hábito</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task.id)} className="h-7 w-7 text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
            <Trash2 className="h-3.5 w-3.5" />
            <span className="sr-only">Deletar Hábito</span>
          </Button>
        </div>
      </div>

      {isFormOpen && (
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
          }}
        >
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">Editar Hábito</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Atualize os detalhes do seu hábito recorrente.
              </DialogDescription>
            </DialogHeader>
            <RecurringTaskForm
              initialData={task}
              onTaskSaved={refetchTasks}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
};

export default RecurringTaskItem;