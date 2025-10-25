"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from '@/integrations/supabase/client';
import { useSession } from "@/integrations/supabase/auth";
import { Task, TaskCurrentBoard } from '@/types/task';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { format, isBefore, startOfDay, parseISO, differenceInDays } from "date-fns";
import { cn, formatDateTime } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { showError, showSuccess } from "@/utils/toast";
import useEmblaCarousel, { EmblaCarouselType } from 'embla-carousel-react';

interface OverdueTasksReminderProps {
  onTaskUpdated: () => void;
}

const fetchOverdueTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("is_completed", false)
    // Fetch tasks where due_date is strictly before today (startOfDay)
    .lt("due_date", format(startOfDay(new Date()), "yyyy-MM-dd"))
    .order("due_date", { ascending: true });

  if (error) {
    throw error;
  }
  return data as Task[] || [];
};

// Helper to map origin board to a display name
const getBoardDisplayName = (board: TaskCurrentBoard) => {
    switch (board) {
        case "today_high_priority": return "Prioridade Alta";
        case "today_medium_priority": return "Prioridade Média";
        case "week_low_priority": return "Semana Baixa";
        case "general": return "Woe Comunicação";
        case "client_tasks": return "Clientes Fixos";
        case "urgent": return "Urgente";
        default: return "Geral";
    }
};

const OverdueTasksReminder: React.FC<OverdueTasksReminderProps> = ({ onTaskUpdated }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const { data: overdueTasks, isLoading, error } = useQuery<Task[], Error>({
    queryKey: ["overdueTasks", userId],
    queryFn: () => fetchOverdueTasks(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 1, // 1 minute
  });
  
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    align: 'start', 
    loop: false, 
    dragFree: true, // Permite arrastar livremente no mobile
    containScroll: 'trimSnaps',
  });
  
  const [prevBtnDisabled, setPrevBtnDisabled] = useState(true);
  const [nextBtnDisabled, setNextBtnDisabled] = useState(true);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  const onSelect = useCallback((emblaApi: EmblaCarouselType) => {
    setPrevBtnDisabled(!emblaApi.canScrollPrev());
    setNextBtnDisabled(!emblaApi.canScrollNext());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect(emblaApi);
    emblaApi.on('reInit', onSelect);
    emblaApi.on('select', onSelect);
  }, [emblaApi, onSelect]);


  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      
      // 1. Update task status
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
      
      // 2. Update points
      const { data: profileData, error: fetchProfileError } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", userId)
        .single();

      let currentPoints = 0;
      if (profileData) {
        currentPoints = profileData.points || 0;
      }

      const newPoints = currentPoints + 10;
      await supabase
        .from("profiles")
        .update({ points: newPoints, updated_at: new Date().toISOString() })
        .eq("id", userId);
    },
    onSuccess: () => {
      showSuccess("Tarefa concluída com sucesso!");
      onTaskUpdated();
      queryClient.invalidateQueries({ queryKey: ["overdueTasks", userId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks"] });
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["profileDashboardSummary", userId] });
    },
    onError: (err: any) => {
      showError("Erro ao concluir tarefa: " + err.message);
    },
  });

  if (isLoading || !overdueTasks) {
    return null;
  }
  
  if (overdueTasks.length === 0) {
    return null;
  }

  return (
    // Main container spanning full width (no horizontal padding here)
    <div className="w-full bg-card border-b border-border shadow-lg py-4">
      <div className="px-4 sm:px-6 lg:px-8">
        <h2 className="text-lg font-bold text-primary flex items-center mb-3">
          {/* Animated Alert Icon */}
          <AlertCircle className="inline-block mr-2 h-5 w-5 text-primary animate-pulse" />
          {overdueTasks.length} Tarefa(s) Atrasada(s)
        </h2>
      </div>
      
      {/* Embla Carousel Container */}
      <div className="relative">
        <div className="embla overflow-hidden" ref={emblaRef}>
          <div className="embla__container flex pl-4 sm:pl-6 lg:pl-8"> {/* Added padding-left */}
            <AnimatePresence initial={false}>
              {overdueTasks.map(task => {
                const dueDate = task.due_date ? parseISO(task.due_date) : null;
                const daysOverdue = dueDate ? differenceInDays(startOfDay(new Date()), startOfDay(dueDate)) : 0;
                const isUrgent = daysOverdue >= 3;

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50, transition: { duration: 0.3 } }}
                    transition={{ duration: 0.3 }}
                    className="embla__slide flex-shrink-0 w-[85vw] sm:w-[320px] mr-3" // Ajuste de largura
                  >
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <Card className={cn(
                          "w-full bg-secondary border border-border rounded-xl shadow-minimal p-3 flex flex-col justify-between h-full",
                          isUrgent && "border-primary ring-1 ring-primary/50"
                        )}>
                          <CardHeader className="p-0 pb-1">
                            <CardTitle className="text-sm font-semibold text-foreground truncate">{task.title}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-0 text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="bg-primary/10 text-primary h-5 px-1.5 text-xs">
                                    {getBoardDisplayName(task.origin_board)}
                                </Badge>
                                <p className={cn("text-xs font-bold flex-shrink-0", isUrgent ? "text-primary" : "text-muted-foreground")}>
                                  {daysOverdue} DIAS DE ATRASO
                                </p>
                            </div>
                            {dueDate && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" /> Vencimento: {formatDateTime(dueDate, false)}
                              </p>
                            )}
                          </CardContent>
                          <CardFooter className="p-0 mt-2 flex items-center justify-end">
                            <Button 
                              size="sm" 
                              className="bg-green-600 text-white hover:bg-green-700 h-7 text-xs"
                              onClick={() => completeTaskMutation.mutate(task.id)}
                              disabled={completeTaskMutation.isPending}
                            >
                              <CheckCircle2 className="mr-2 h-3 w-3" /> Concluir
                            </Button>
                          </CardFooter>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1 max-w-xs">
                          <p className="text-sm font-semibold">{task.title}</p>
                          <p className="text-xs">Descrição: {task.description || 'Nenhuma descrição'}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Navigation Buttons (Desktop Only) */}
        <div className="hidden md:block absolute top-1/2 transform -translate-y-1/2 w-full px-4 sm:px-6 lg:px-8 pointer-events-none">
          <Button
            variant="ghost"
            size="icon"
            onClick={scrollPrev}
            disabled={prevBtnDisabled}
            className="absolute left-0 top-0 transform -translate-x-1/2 pointer-events-auto bg-card/80 hover:bg-card/90 backdrop-blur-sm border border-border h-8 w-8 z-10"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={scrollNext}
            disabled={nextBtnDisabled}
            className="absolute right-0 top-0 transform translate-x-1/2 pointer-events-auto bg-card/80 hover:bg-card/90 backdrop-blur-sm border border-border h-8 w-8 z-10"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OverdueTasksReminder;