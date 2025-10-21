"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Task } from "@/types/task";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, ArrowLeft, Coffee, PartyPopper } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

const fetchFocusTasks = async (userId: string): Promise<Task[]> => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, current_board, is_priority,
      task_tags(tags(id, name, color))
    `)
    .eq("user_id", userId)
    .eq("is_completed", false)
    .in("current_board", ["overdue", "today_high_priority", "today_medium_priority", "general", "week_low_priority"])
    .or(`due_date.eq.${today},current_board.in.("overdue","today_high_priority","today_medium_priority")`);

  if (error) throw error;
  const mappedData = data?.map((task: any) => ({
    ...task,
    tags: task.task_tags.map((tt: any) => tt.tags),
  })) || [];
  return mappedData;
};

const FocusMode: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: tasks, isLoading, error, refetch } = useQuery<Task[], Error>({
    queryKey: ["focusTasks", userId],
    queryFn: () => fetchFocusTasks(userId!),
    enabled: !!userId,
  });

  const priorityOrder: Record<string, number> = {
    "overdue": 1,
    "today_high_priority": 2,
    "today_medium_priority": 3,
  };

  const currentTask = useMemo(() => {
    if (!tasks) return null;
    return tasks
      .sort((a, b) => {
        const priorityA = priorityOrder[a.current_board] || 4;
        const priorityB = priorityOrder[b.current_board] || 4;
        return priorityA - priorityB;
      })
      .find(task => !task.is_completed);
  }, [tasks]);

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("tasks")
        .update({ is_completed: true, completed_at: new Date().toISOString(), current_board: 'completed' })
        .eq("id", taskId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Tarefa concluída! Próxima...");
      queryClient.invalidateQueries({ queryKey: ["focusTasks", userId] });
      queryClient.invalidateQueries({ queryKey: ["allTasks", userId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks", userId] });
    },
    onError: (err: any) => {
      showError("Erro ao concluir tarefa: " + err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar tarefas: " + error.message);
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background z-50 p-4">
        <h1 className="text-2xl font-bold text-red-500">Erro ao carregar Modo Foco</h1>
        <Button onClick={() => navigate("/dashboard")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background z-50 p-4">
      <Button onClick={() => navigate("/dashboard")} className="absolute top-6 left-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Sair do Modo Foco
      </Button>

      <AnimatePresence mode="wait">
        {currentTask ? (
          <motion.div
            key={currentTask.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-2xl"
          >
            <Card className="bg-card border-border shadow-2xl frosted-glass">
              <CardHeader>
                <CardDescription>Sua próxima tarefa é:</CardDescription>
                <CardTitle className="text-3xl font-bold text-primary">{currentTask.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {currentTask.description && (
                  <p className="text-muted-foreground mb-6">{currentTask.description}</p>
                )}
                <Button
                  onClick={() => completeTaskMutation.mutate(currentTask.id)}
                  disabled={completeTaskMutation.isPending}
                  className="w-full text-lg py-6 bg-green-600 hover:bg-green-700"
                >
                  {completeTaskMutation.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                  )}
                  Concluir Tarefa
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="all-done"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <PartyPopper className="h-24 w-24 text-green-500 mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-foreground">Você finalizou tudo hoje, excelente foco!</h1>
            <p className="text-xl text-muted-foreground mt-2">Aproveite para fazer uma pausa.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FocusMode;