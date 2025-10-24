"use client";

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Task, TaskCurrentBoard } from '@/types/task';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, CalendarDays } from "lucide-react";
import { format, isBefore, startOfDay, parseISO, differenceInDays } from "date-fns";
import { cn, formatDateTime } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface OverdueTasksReminderProps {
  onTaskUpdated: () => void;
}

const fetchOverdueTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("is_completed", false)
    .lt("due_date", format(startOfDay(new Date()), "yyyy-MM-dd"))
    .order("due_date", { ascending: true });

  if (error) {
    throw error;
  }
  return data as Task[] || [];
};

const OverdueTasksReminder: React.FC<OverdueTasksReminderProps> = ({ onTaskUpdated }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const { data: overdueTasks, isLoading, error } = useQuery<Task[], Error>({
    queryKey: ["overdueTasks", userId],
    queryFn: () => fetchOverdueTasks(userId!),
    enabled: !!userId,
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          is_completed: true,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          current_board: "completed",
          overdue: false,
        })
        .eq("id", taskId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      showSuccess("Tarefa concluída com sucesso!");
      onTaskUpdated();
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: any) => {
      showError("Erro ao concluir tarefa: " + err.message);
    },
  });

  if (!overdueTasks || overdueTasks.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#1A1C1F] text-[#E6E6E6] p-4 rounded-md mb-4">
      <h2 className="text-lg font-semibold text-primary">
        <AlertCircle className="inline-block mr-2 h-5 w-5 animate-pulse" />
        Tarefas Atrasadas
      </h2>
      <div className="overflow-x-auto whitespace-nowrap">
        {overdueTasks.map(task => {
          const dueDate = task.due_date ? parseISO(task.due_date) : null;
          const daysOverdue = dueDate ? differenceInDays(new Date(), dueDate) : 0;
          const isUrgent = daysOverdue > 7;

          return (
            <Tooltip key={task.id} delayDuration={200}>
              <TooltipTrigger asChild>
                <Card className={cn(
                  "inline-block w-80 bg-card border border-border rounded-md shadow-sm p-3 mr-2 last:mr-0",
                  isUrgent && "border-red-500 ring-1 ring-red-500/50"
                )}>
                  <CardHeader className="p-0">
                    <CardTitle className="text-sm font-semibold text-foreground truncate">{task.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 text-sm text-muted-foreground">
                    {task.origin_board}
                    {dueDate && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" /> {formatDateTime(dueDate, false)}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="p-0 mt-2 flex items-center justify-between">
                    <p className={cn("text-xs font-bold", isUrgent ? "text-red-500" : "text-muted-foreground")}>
                      {daysOverdue} DIAS DE ATRASO {isUrgent && "⚠️"}
                    </p>
                    <Button 
                      size="sm" 
                      className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs"
                      onClick={() => completeTaskMutation.mutate(task.id)}
                      disabled={completeTaskMutation.isLoading}
                    >
                      <CheckCircle2 className="mr-2 h-3 w-3" /> Concluir
                    </Button>
                  </CardFooter>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Detalhes da Tarefa</p>
                  <p className="text-xs">Descrição: {task.description || 'Nenhuma descrição'}</p>
                  <p className="text-xs">Criada em: {formatDateTime(task.created_at)}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

export default OverdueTasksReminder;