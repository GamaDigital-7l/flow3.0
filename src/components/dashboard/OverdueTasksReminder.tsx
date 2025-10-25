"use client";

import React, { useRef } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, CheckCircle2, Loader2, CalendarDays } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { parseISO } from '@/lib/utils';
import { differenceInDays, isBefore, startOfDay, format } from 'date-fns';
import { Task } from '@/types/task'; // Importando o tipo Task completo
import { ptBR } from 'date-fns/locale';

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
      
      // Atualização de pontos (simplificada, assumindo que a lógica de pontos está em outro lugar ou será reintroduzida)
      // Apenas invalidando queries para forçar o recarregamento
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
        <h2 className="text-lg font-semibold flex items-center text-primary">
          <AlertCircle className="h-5 w-5 mr-2 text-primary" />
          {tasks.length} Tarefa(s) Atrasada(s)
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
          const dueDate = parseISO(task.due_date);
          // Calcula a diferença em dias entre a data de vencimento e hoje
          // Usamos Math.max(1, ...) para garantir que seja pelo menos 1 dia de atraso, como na imagem.
          const daysOverdue = Math.max(1, differenceInDays(startOfDay(new Date()), dueDate));
          
          return (
            <Card 
              key={task.id} 
              className="p-4 bg-card border border-status-overdue/50 flex-shrink-0 shadow-lg card-hover-effect"
              style={{ width: '240px' }} 
            >
              <div className="flex flex-col space-y-2">
                <p className="font-semibold text-base truncate text-foreground">{task.title}</p>
                
                <div className="flex items-center justify-between text-xs">
                  <Badge 
                    className={cn(
                      "h-5 px-1.5 text-xs flex-shrink-0",
                      // Usando a cor primária para o badge de prioridade alta
                      task.is_priority ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    Prioridade Alta
                  </Badge>
                  <p className="text-xs text-primary font-medium ml-2 flex-shrink-0">
                    {daysOverdue} DIA{daysOverdue > 1 ? 'S' : ''} DE ATRASO
                  </p>
                </div>
                
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Vencimento: {format(dueDate, 'dd/MM/yyyy', { locale: ptBR })}
                </p>
                
                <Button 
                  size="sm" 
                  onClick={() => completeTaskMutation.mutate(task.id)} 
                  className="w-full bg-green-600 text-white hover:bg-green-700 h-8 text-sm mt-2"
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