import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import TaskListBoard from "@/components/dashboard/TaskListBoard";
import HabitListBoard from "@/components/dashboard/HabitListBoard";
import { useTodayHabits } from "@/hooks/useHabits";
import { Task, TaskCurrentBoard } from "@/types/task";
import { Loader2, PlusCircle } from "lucide-react";
import { showError } from "@/utils/toast";
import QuickAddTaskInput from "@/components/dashboard/QuickAddTaskInput";
import DashboardResultsSummary from "@/components/dashboard/DashboardResultsSummary";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { format } from "date-fns";
import OverdueTasksReminder from "@/components/dashboard/OverdueTasksReminder";
import DashboardWrapper from "@/components/layout/DashboardWrapper";

const BOARD_DEFINITIONS: { id: TaskCurrentBoard; title: string; }[] = [
  { id: "today_high_priority", title: "Hoje — Prioridade Alta" },
  { id: "today_medium_priority", title: "Hoje — Prioridade Média" },
  { id: "week_low_priority", title: "Esta Semana — Baixa" },
  { id: "general", title: "Woe Comunicação" },
  { id: "client_tasks", title: "Clientes Fixos" },
];

const fetchTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase.from("tasks").select(`*, task_tags(tags(*))`).eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data?.map((task: any) => ({ ...task, tags: task.task_tags.map((tt: any) => tt.tags) })) || [];
};

interface OverdueTask { id: string; title: string; due_date: string; }

const fetchOverdueTasks = async (userId: string): Promise<OverdueTask[]> => {
  const { data, error } = await supabase.from("tasks").select("id, title, due_date").eq("user_id", userId).eq("overdue", true).eq("is_completed", false).order("due_date", { ascending: true });
  if (error) throw error;
  return data || [];
};

const Dashboard: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: allTasks = [], isLoading: isLoadingTasks, error: errorTasks, refetch: refetchTasks } = useQuery<Task[], Error>({ queryKey: ["allTasks", userId], queryFn: () => fetchTasks(userId!), enabled: !!userId });
  const { data: overdueTasks = [], isLoading: isLoadingOverdue, refetch: refetchOverdue } = useQuery<OverdueTask[], Error>({ queryKey: ["overdueTasks", userId], queryFn: () => fetchOverdueTasks(userId!), enabled: !!userId });
  const { todayHabits, isLoading: isLoadingHabits, error: errorHabits, refetch: refetchHabits } = useTodayHabits();
  
  const [isTaskFormOpen, setIsTaskFormOpen] = React.useState(false);

  const handleTaskUpdated = () => {
    refetchTasks();
    refetchOverdue();
    setIsTaskFormOpen(false);
  };
  
  const handleHabitUpdated = () => { refetchHabits(); };

  const dashboardTasks = allTasks.filter(task => !task.is_completed);

  if (isLoadingTasks || isLoadingHabits || isLoadingOverdue) {
    return (
      <div className="flex items-center justify-center h-screen text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando seu dia...
      </div>
    );
  }

  return (
    // O DashboardWrapper agora envolve todo o conteúdo da página.
    <DashboardWrapper className="py-6 space-y-8">
      {/* Seção 1: Cabeçalho da Página */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Dashboard</h1>
          <p className="text-muted-foreground">Seu resumo de tarefas e fluxo de trabalho.</p>
        </div>
        <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa</Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle>Adicionar Nova Tarefa</DialogTitle>
              <DialogDescription>Crie uma nova tarefa para organizar seu dia.</DialogDescription>
            </DialogHeader>
            <TaskForm onTaskSaved={handleTaskUpdated} onClose={() => setIsTaskFormOpen(false)} initialOriginBoard="general" />
          </DialogContent>
        </Dialog>
      </div>

      {/* Seção 2: Lembrete de Tarefas Atrasadas (agora dentro do wrapper) */}
      {overdueTasks.length > 0 && (
        <OverdueTasksReminder 
          tasks={overdueTasks.map(t => ({ id: t.id, title: t.title, due_date: t.due_date ? format(new Date(t.due_date), 'dd/MM') : 'N/A' }))} 
          onTaskUpdated={handleTaskUpdated}
        />
      )}

      {/* Seção 3: Fluxo de Trabalho Principal */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4 pt-4 border-t border-border">Seu Fluxo de Trabalho</h2>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <HabitListBoard habits={todayHabits || []} isLoading={isLoadingHabits} error={errorHabits} refetchHabits={handleHabitUpdated} />
          {BOARD_DEFINITIONS.map((board) => (
            <TaskListBoard
              key={board.id}
              title={board.title}
              tasks={dashboardTasks.filter(t => t.current_board === board.id)}
              isLoading={isLoadingTasks}
              error={errorTasks}
              refetchTasks={handleTaskUpdated}
              quickAddTaskInput={<QuickAddTaskInput originBoard={board.id} onTaskAdded={handleTaskUpdated} dueDate={new Date()} />}
              originBoard={board.id}
            />
          ))}
        </div>
      </div>
      
      {/* Seção 4: Métricas de Produtividade */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4 pt-4">Métricas de Produtividade</h2>
        <DashboardResultsSummary />
      </div>
    </DashboardWrapper>
  );
};

export default Dashboard;