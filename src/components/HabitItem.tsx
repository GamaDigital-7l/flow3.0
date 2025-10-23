// src/components/HabitItem.tsx
import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, CheckCircle2, AlertCircle, Repeat, Pause, Play, MoreVertical } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { Habit, WEEKDAY_LABELS } from "@/types/habit";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import HabitForm from "@/components/HabitForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { useToggleHabitCompletion } from "@/hooks/useHabits";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface HabitItemProps {
  habit: Habit;
  refetchHabits: () => void;
  compactMode?: boolean;
  showActions?: boolean;
}

const HabitItem: React.FC<HabitItemProps> = ({ habit, refetchHabits, compactMode = false, showActions = true }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const toggleCompletionMutation = useToggleHabitCompletion();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingHabit, setEditingHabit] = React.useState<Habit | undefined>(undefined);

  const handleToggleCompletion = (completed: boolean) => {
    toggleCompletionMutation.mutate({ habit, completed });
  };

  const handleDeleteHabit = useMutation({
    mutationFn: async (recurrenceId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      if (!window.confirm("Tem certeza que deseja deletar ESTE HÁBITO e TODO O SEU HISTÓRICO?")) return;
      
      // Deleta todas as instâncias e o histórico associado ao recurrence_id
      const { error: deleteHistoryError } = await supabase
        .from("recurrence_history") // MUDANÇA: Nova tabela
        .delete()
        .eq("recurrence_id", recurrenceId)
        .eq("user_id", userId);
        
      if (deleteHistoryError) console.error("Error deleting habit history:", deleteHistoryError);

      const { error: deleteHabitsError } = await supabase
        .from("recurrence_instances") // MUDANÇA: Nova tabela
        .delete()
        .eq("recurrence_id", recurrenceId)
        .eq("user_id", userId);

      if (deleteHabitsError) throw deleteHabitsError;
    },
    onSuccess: () => {
      showSuccess("Hábito e histórico deletados com sucesso!");
      refetchHabits();
      queryClient.invalidateQueries({ queryKey: ["todayHabits", userId] });
      queryClient.invalidateQueries({ queryKey: ["allHabitDefinitions", userId] });
    },
    onError: (err: any) => {
      showError("Erro ao deletar hábito: " + err.message);
    },
  });

  const handleEditHabit = (habitToEdit: Habit) => {
    setEditingHabit(habitToEdit);
    setIsFormOpen(true);
  };
  
  const handlePauseToggle = useMutation({
    mutationFn: async (paused: boolean) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      // Atualiza todas as instâncias com o mesmo recurrence_id
      const { error } = await supabase
        .from("recurrence_instances") // MUDANÇA: Nova tabela
        .update({ paused: paused, updated_at: new Date().toISOString() })
        .eq("recurrence_id", habit.recurrence_id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (data, variables) => {
      showSuccess(`Hábito ${habit.paused ? 'retomado' : 'pausado'} com sucesso!`);
      refetchHabits();
      queryClient.invalidateQueries({ queryKey: ["todayHabits", userId] });
      queryClient.invalidateQueries({ queryKey: ["allHabitDefinitions", userId] });
    },
    onError: (err: any) => {
      showError("Erro ao pausar/retomar hábito: " + err.message);
    },
  });

  const isCompleted = habit.completed_today;
  const isAlert = habit.alert && !isCompleted;
  const isPaused = habit.paused;

  return (
    <>
      <Card className={cn(
        "border border-border rounded-lg bg-card shadow-sm transition-all duration-200",
        isCompleted ? "opacity-70 border-green-500/50" : "card-hover-effect",
        isAlert && "border-red-500 ring-1 ring-red-500/50",
        compactMode ? "p-1.5" : "p-2"
      )}>
        <div className="flex items-start gap-2">
          {/* Checkbox */}
          <Checkbox
            id={`habit-${habit.id}`}
            checked={isCompleted}
            onCheckedChange={(checked) => handleToggleCompletion(checked as boolean)}
            className={cn("border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0 mt-1", compactMode ? "h-3.5 w-3.5" : "h-4 w-4")}
            disabled={toggleCompletionMutation.isPending || isPaused}
          />
          <div className="grid gap-0.5 flex-grow min-w-0">
            <label
              htmlFor={`habit-${habit.id}`}
              className={cn(
                "font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70 break-words",
                isCompleted && "line-through text-muted-foreground",
                compactMode ? "text-xs" : "text-sm"
              )}
            >
              {habit.title}
            </label>
            {habit.description && (
              <p className={cn("text-muted-foreground break-words line-clamp-1", compactMode ? "text-[0.65rem]" : "text-xs")}>{habit.description}</p>
            )}
            <div className="flex flex-wrap gap-1 mt-0.5">
              <Badge className="bg-status-recurring text-white h-5 px-1.5 text-xs flex items-center gap-1">
                <Repeat className="h-3 w-3" /> {habit.frequency === 'daily' ? 'Diário' : habit.frequency === 'weekly' ? 'Semanal' : 'Custom'}
              </Badge>
              {habit.streak > 0 && (
                <Badge variant="secondary" className="bg-green-500/20 text-green-500 border-green-500/50 h-5 px-1.5 text-xs">
                  Streak: {habit.streak} dias
                </Badge>
              )}
            </div>
            {isAlert && (
              <p className={cn("text-red-500 mt-1 flex items-center gap-1", compactMode ? "text-[0.65rem]" : "text-xs")}>
                <AlertCircle className={cn("flex-shrink-0", compactMode ? "h-3 w-3" : "h-3 w-3")} /> ⚠️ Não quebre o hábito 2 dias seguidos!
              </p>
            )}
            {isPaused && (
              <p className={cn("text-muted-foreground mt-1 flex items-center gap-1", compactMode ? "text-[0.65rem]" : "text-xs")}>
                <Pause className={cn("flex-shrink-0", compactMode ? "h-3 w-3" : "h-3 w-3")} /> Hábito Pausado
              </p>
            )}
          </div>
          
          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground flex-shrink-0">
                  <MoreVertical className="h-3.5 w-3.5" />
                  <span className="sr-only">Mais Ações</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border rounded-md shadow-lg text-sm">
                <DropdownMenuItem onClick={() => handleEditHabit(habit)} className="cursor-pointer py-1.5 px-2">
                  <Edit className="mr-2 h-4 w-4" /> Editar Definição
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePauseToggle.mutate(!isPaused)} className="cursor-pointer py-1.5 px-2">
                  {isPaused ? <><Play className="mr-2 h-4 w-4" /> Retomar Hábito</> : <><Pause className="mr-2 h-4 w-4" /> Pausar Hábito</>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDeleteHabit.mutate(habit.recurrence_id)} className="text-red-600 cursor-pointer py-1.5 px-2">
                  <Trash2 className="mr-2 h-4 w-4" /> Deletar Hábito (Histórico)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </Card>

      {isFormOpen && (
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingHabit(undefined);
          }}
        >
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">Editar Hábito</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Atualize os detalhes do seu hábito.
              </DialogDescription>
            </DialogHeader>
            <HabitForm
              initialData={editingHabit}
              onHabitSaved={refetchHabits}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default HabitItem;