"use client";

import React, { useRef } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { parseISO } from '@/lib/utils';
import { differenceInDays } from 'date-fns'; // Importando differenceInDays

interface OverdueTask {
  id: string;
  title: string;
  due_date: string;
}

interface OverdueTasksReminderProps {
  tasks: OverdueTask[];
  onTaskUpdated: () => void;
}

const OverdueTasksReminder: React.FC<OverdueTasksReminderProps> = ({ tasks, onTaskUpdated }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  if (tasks.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'right' ? scrollAmount : -scrollAmount,
        behavior: 'smooth',
      });
    }
  };
  
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
      
      // Simplificação: não atualiza pontos aqui, mas invalida as queries
    },
    onSuccess: () => {
      showSuccess("Tarefa concluída!");
      onTaskUpdated(); // Refetch tasks and overdue list
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
    onError: (err: any) => {
      showError("Erro ao concluir tarefa: " + err.message);
    },
  });

  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold flex items-center text-status-overdue">
          <AlertCircle className="h-5 w-5 mr-2" />
          Tarefas Atrasadas ({tasks.length})
        </h2>
        
        {/* Botões de Navegação (Apenas Desktop) */}
        {!isMobile && (
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => scroll('left')} className="h-8 w-8 text-muted-foreground hover:bg-accent">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => scroll('right')} className="h-8 w-8 text-muted-foreground hover:bg-accent">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      
      {/* Container de Scroll Horizontal */}
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto space-x-3 pb-2 custom-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {tasks.map((task) => {
          // Calcula a diferença em dias entre a data de vencimento e hoje
          const daysOverdue = task.due_date ? Math.abs(differenceInDays(parseISO(task.due_date), new Date())) : 0;
          
          return (
            <Card 
              key={task.id} 
              // Estilo visual padrão do app, compacto
              className="p-3 bg-card border border-border flex-shrink-0 shadow-sm card-hover-effect"
              style={{ width: '240px' }} 
            >
              <div className="flex flex-col space-y-1">
                <p className="font-medium text-sm truncate text-foreground">{task.title}</p>
                <div className="flex items-center justify-between">
                  <Badge className="bg-status-overdue text-white h-5 px-1.5 text-xs flex-shrink-0">
                    Atrasada
                  </Badge>
                  <p className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                    {daysOverdue} dias
                  </p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => completeTaskMutation.mutate(task.id)} 
                  className="w-full bg-primary text-white hover:bg-primary/90 h-8 text-xs mt-2"
                  disabled={completeTaskMutation.isPending}
                >
                  {completeTaskMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                  Concluir
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default OverdueTasksReminder;