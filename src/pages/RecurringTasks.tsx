"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Task } from "@/types/task";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, TrendingUp, CalendarDays, Repeat, PlusCircle, Edit, Clock } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { format, differenceInDays, isToday, subDays } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import TaskItem from "@/components/TaskItem";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { cn, parseISO } from "@/lib/utils";

const fetchDailyRecurringTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      last_successful_completion_date, origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, completed_at, updated_at,
      is_daily_recurring, recurrence_streak, recurrence_failure_history, last_completion_date, recurrence_time,
      task_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId)
    .eq("is_daily_recurring", true)
    .order("title", { ascending: true });

  if (error) throw error;
  const mappedData = data?.map((task: any) => ({
    ...task,
    tags: task.task_tags.map((tt: any) => tt.tags),
  })) || [];
  return mappedData;
};

const calculateMetrics = (tasks: Task[]) => {
  const today = new Date();
  const last30Days = Array.from({ length: 30 }, (_, i) => subDays(today, i));
  const last7Days = last30Days.slice(0, 7);

  const getCompletionRate = (days: Date[]) => {
    let totalPossibleCompletions = days.length * tasks.length;
    let totalFailures = 0;

    tasks.forEach(task => {
        days.forEach(day => {
            const dayISO = format(day, 'yyyy-MM-dd');
            // Verifica se a falha ocorreu neste dia
            if (task.recurrence_failure_history?.includes(dayISO)) {
                totalFailures++;
            }
        });
    });
    
    if (totalPossibleCompletions === 0) return 0;

    const successRate = (totalPossibleCompletions - totalFailures) / totalPossibleCompletions;
    return Math.round(successRate * 100);
  };

  return {
    rate7Days: getCompletionRate(last7Days),
    rate30Days: getCompletionRate(last30Days),
  };
};

const RecurringTasks: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  const { data: recurringTasks = [], isLoading, error, refetch } = useQuery<Task[], Error>({
    queryKey: ["dailyRecurringTasks", userId],
    queryFn: () => fetchDailyRecurringTasks(userId!),
    enabled: !!userId,
  });

  React.useEffect(() => {
    if (error) {
      showError("Erro ao carregar tarefas recorrentes: " + error.message);
    }
  }, [error]);

  const handleTaskUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["dailyRecurringTasks"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    refetch();
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const metrics = calculateMetrics(recurringTasks);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando recorrentes...
      </div>
    );
  }

  const tasksToday = recurringTasks.filter(t => !t.is_completed);
  const tasksCompletedToday = recurringTasks.filter(t => t.is_completed);

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Repeat className="h-7 w-7 text-primary" /> Recorrentes Diárias
        </h1>
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingTask(undefined);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTask(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Recorrente
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingTask ? "Editar Recorrente" : "Nova Recorrente Diária"}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingTask ? "Atualize os detalhes da sua tarefa diária inegociável." : "Crie uma tarefa que se repete todos os dias e rastreia seu streak."}
              </DialogDescription>
            </DialogHeader>
            <TaskForm
              initialData={editingTask ? { 
                ...editingTask, 
                due_date: editingTask.due_date ? parseISO(editingTask.due_date) : undefined,
                is_daily_recurring: true, // Forçar para true no formulário de recorrentes
                recurrence_type: 'daily',
              } : {
                is_daily_recurring: true,
                recurrence_type: 'daily',
                origin_board: 'recurring',
                current_board: 'recurring',
              }}
              onTaskSaved={() => {
                setIsFormOpen(false);
                handleTaskUpdate();
              }}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground mb-8">
        Suas tarefas diárias que devem ser concluídas todos os dias para manter o streak.
      </p>

      {/* Métricas de Streak */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-card border-border shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conclusão (7 Dias)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{metrics.rate7Days}%</div>
            <Progress value={metrics.rate7Days} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conclusão (30 Dias)</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{metrics.rate30Days}%</div>
            <Progress value={metrics.rate30Days} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tarefas Pendentes Hoje</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{tasksToday.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tarefas Pendentes */}
      <Card className="mb-8 bg-card border-border shadow-lg frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Pendentes ({tasksToday.length})</CardTitle>
          <CardDescription className="text-muted-foreground">Conclua estas tarefas hoje para manter seu streak.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasksToday.length > 0 ? (
            tasksToday.map(task => (
              <TaskItem
                key={task.id}
                task={{ ...task, current_board: 'recurring' }}
                refetchTasks={handleTaskUpdate}
                isDailyRecurringView={true}
              />
            ))
          ) : (
            <p className="text-muted-foreground">Todas as recorrentes diárias concluídas! 🎉</p>
          )}
        </CardContent>
      </Card>

      {/* Tarefas Concluídas Hoje */}
      {tasksCompletedToday.length > 0 && (
        <Card className="bg-card border-border shadow-lg frosted-glass card-hover-effect">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-green-600 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> Concluídas Hoje ({tasksCompletedToday.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasksCompletedToday.map(task => (
              <TaskItem
                key={task.id}
                task={{ ...task, current_board: 'recurring' }}
                refetchTasks={handleTaskUpdate}
                isDailyRecurringView={true}
              />
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Lista de todas as recorrentes para edição rápida */}
      <Card className="mt-8 bg-card border-border shadow-lg frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Gerenciar Todas as Recorrentes</CardTitle>
          <CardDescription className="text-muted-foreground">Clique para editar ou desativar uma tarefa recorrente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recurringTasks.length > 0 ? (
            recurringTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{task.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Streak atual: {task.recurrence_streak || 0} dias
                  </p>
                  {task.recurrence_time && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Lembrete: {task.recurrence_time}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleEditTask(task)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Nenhuma tarefa recorrente diária configurada.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RecurringTasks;