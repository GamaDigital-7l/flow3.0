"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { format, differenceInDays, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { cn, parseISO } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface OverdueTask {
  id: string;
  title: string;
  due_date: string;
  is_priority: boolean;
}

interface OverdueTasksReminderProps {
  tasks: OverdueTask[];
  onTaskUpdated: () => void;
}

const OverdueTasksReminder: React.FC<OverdueTasksReminderProps> = ({ tasks, onTaskUpdated }) => {
  const queryClient = useQueryClient();

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Tarefa concluída!");
      onTaskUpdated();
    },
    onError: (err: any) => {
      showError("Erro ao concluir tarefa: " + err.message);
    },
  });

  if (tasks.length === 0) {
    return null;
  }

  const todayStart = startOfDay(new Date());

  const getDelayStatus = (dueDateStr: string) => {
    const dueDate = parseISO(dueDateStr);
    const delayDays = differenceInDays(todayStart, dueDate);
    
    if (delayDays === 1) {
      return "1 DIA DE ATRASO";
    }
    if (delayDays > 1) {
      return `${delayDays} DIAS DE ATRASO`;
    }
    return "ATRASADO";
  };

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <AlertCircle className="h-6 w-6 text-status-overdue" /> 
        {tasks.length} Tarefa(s) Atrasada(s)
      </h2>

      {/* Carrossel Horizontal */}
      <div className="flex overflow-x-auto space-x-4 pb-2 custom-scrollbar">
        {tasks.map((task) => (
          <Card 
            key={task.id} 
            className={cn(
              "flex-shrink-0 w-[90vw] sm:w-[300px] md:w-[350px] lg:w-[400px]", // Largura fixa para forçar o scroll horizontal
              "bg-card border-status-overdue/50 shadow-lg"
            )}
          >
            <CardHeader className="p-3 pb-1">
              <div className="flex justify-between items-start">
                <CardTitle className="text-base font-semibold line-clamp-2 text-foreground">
                  {task.title}
                </CardTitle>
                <Badge 
                  className={cn(
                    "text-xs font-bold uppercase",
                    "bg-status-overdue/10 text-status-overdue border border-status-overdue/50"
                  )}
                >
                  {getDelayStatus(task.due_date)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-2 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <p className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Vencimento: {format(parseISO(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
                <Badge variant="secondary" className={cn(
                  "text-xs",
                  task.is_priority ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {task.is_priority ? "Alta Prioridade" : "Prioridade Normal"}
                </Badge>
              </div>
              
              <Button 
                onClick={() => completeTaskMutation.mutate(task.id)} 
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                disabled={completeTaskMutation.isPending}
              >
                {completeTaskMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Concluir
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default OverdueTasksReminder;