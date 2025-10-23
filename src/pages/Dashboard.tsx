"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { isToday } from "date-fns";
import TaskListBoard from "@/components/dashboard/TaskListBoard";
import { Task, TaskCurrentBoard } from "@/types/task";
import { ListTodo, Loader2, AlertCircle, Repeat, Users, DollarSign, TrendingUp, PlusCircle } from "lucide-react";
import { showError } from "@/utils/toast";
import QuickAddTaskInput from "@/components/dashboard/QuickAddTaskInput";
import DashboardFinanceSummary from "@/components/dashboard/DashboardFinanceSummary";
import DashboardResultsSummary from "@/components/dashboard/DashboardResultsSummary"; // Componente de resultados de produtividade
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";

const DASHBOARD_BOARD_DEFINITIONS: { id: TaskCurrentBoard; title: string; icon: React.ReactNode; color: string }[] = [
  { id: "today_high_priority", title: "Hoje — Prioridade Alta", icon: <ListTodo className="h-5 w-5" />, color: "text-red-500" },
  { id: "today_medium_priority", title: "Hoje — Prioridade Média", icon: <ListTodo className="h-5 w-5" />, color: "text-orange-500" },
  { id: "overdue", title: "Atrasadas", icon: <AlertCircle className="h-5 w-5" />, color: "text-red-600" },
];

const fetchTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, completed_at, updated_at,
      task_tags(
        tags(id, name, color)
      ),
      subtasks:tasks!parent_task_id(
        id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
        origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, completed_at, updated_at,
        task_tags(
          tags(id, name, color)
        )
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  const mappedData = data?.map((task: any) => ({
    ...task,
    tags: task.task_tags.map((tt: any) => tt.tags),
    subtasks: task.subtasks.map((sub: any) => ({
      ...sub,
      tags: sub.task_tags.map((t: any) => t.tags),
      template_task_id: null, // Removendo referência ao campo inexistente
    })),
    template_task_id: null, // Removendo referência ao campo inexistente
  })) || [];
  return mappedData;
};

const Dashboard: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const userName = session?.user?.user_metadata?.first_name || "Usuário";

  const { data: allTasks = [], isLoading: isLoadingTasks, error: errorTasks, refetch: refetchTasks } = useQuery<Task[], Error>({
    queryKey: ["allTasks", userId],
    queryFn: () => fetchTasks(userId!),
    enabled: !!userId,
  });

  const [isTaskFormOpen, setIsTaskFormOpen] = React.useState(false);

  React.useEffect(() => {
    if (errorTasks) {
      showError("Erro ao carregar tarefas: " + errorTasks.message);
    }
  }, [errorTasks]);

  const handleTaskUpdated = () => {
    refetchTasks();
    setIsTaskFormOpen(false);
  };

  // As tarefas do dashboard são todas as tarefas que não são templates (pois templates são gerenciados na página /recurring)
  // E as instâncias recorrentes (que têm current_board: 'recurring')
  const dashboardTasks = allTasks.filter(task => task.recurrence_type === 'none' || task.current_board === 'recurring');

  if (isLoadingTasks) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando seu dia...
      </div>
    );
  }

  return (
    <div className="page-content-wrapper space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Dashboard</h1>
          <p className="text-muted-foreground">
            Seu resumo de tarefas e fluxo de trabalho.
          </p>
        </div>
        <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">Adicionar Nova Tarefa</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Crie uma nova tarefa para organizar seu dia.
              </DialogDescription>
            </DialogHeader>
            <TaskForm
              onTaskSaved={handleTaskUpdated}
              onClose={() => setIsTaskFormOpen(false)}
              initialOriginBoard="general"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Seção de Listas de Tarefas (Grid 2x3 ou 1x6) */}
      <h2 className="text-xl font-bold text-foreground pt-4">Tarefas Urgentes</h2>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {DASHBOARD_BOARD_DEFINITIONS.map((board) => (
          <TaskListBoard
            key={board.id}
            title={board.title}
            tasks={dashboardTasks.filter(t => 
              t.current_board === board.id && 
              !t.is_completed
            )}
            isLoading={isLoadingTasks}
            error={errorTasks}
            refetchTasks={handleTaskUpdated}
            quickAddTaskInput={
              board.id !== "overdue" && (
                <QuickAddTaskInput
                  originBoard={board.id}
                  onTaskAdded={handleTaskUpdated}
                  dueDate={new Date()}
                />
              )
            }
            originBoard={board.id}
            selectedDate={new Date()}
          />
        ))}
      </div>

      {/* Seção de Resumos (Financeiro e Produtividade) */}
      <h2 className="text-xl font-bold text-foreground pt-4 border-t border-border">Resumos e Métricas</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="lg:col-span-2 xl:col-span-2">
          <h3 className="text-lg font-bold text-foreground mb-3">Resumo Financeiro do Mês</h3>
          <DashboardFinanceSummary />
        </div>
        <div className="xl:col-span-1">
          <h3 className="text-lg font-bold text-foreground mb-3">Produtividade</h3>
          <DashboardResultsSummary />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;