import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { isToday } from "date-fns";
import TaskListBoard from "@/components/dashboard/TaskListBoard";
import HabitListBoard from "@/components/dashboard/HabitListBoard";
import { useTodayHabits } from "@/hooks/useHabits";
import { Task, TaskCurrentBoard } from "@/types/task";
import { ListTodo, Loader2, AlertCircle, Repeat, Users, DollarSign, TrendingUp, PlusCircle } from "lucide-react";
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

const BOARD_DEFINITIONS: { id: TaskCurrentBoard; title: string; icon: React.ReactNode; color: string }[] = [
  { id: "today_high_priority", title: "Hoje — Prioridade Alta", icon: <ListTodo className="h-5 w-5" />, color: "text-primary" },
  { id: "today_medium_priority", title: "Hoje — Prioridade Média", icon: <ListTodo className="h-5 w-5" />, color: "text-orange-500" },
  { id: "week_low_priority", title: "Esta Semana — Baixa", icon: <ListTodo className="h-5 w-5" />, color: "text-yellow-600" },
  { id: "general", title: "Woe Comunicação", icon: <ListTodo className="h-5 w-5" />, color: "text-muted-foreground" },
  { id: "client_tasks", title: "Clientes Fixos", icon: <Users className="h-5 w-5" />, color: "text-blue-500" },
];

const fetchTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, 
      origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, completed_at, updated_at,
      task_tags(
        tags(id, name, color)
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
    template_task_id: null,
  })) || [];
  return mappedData;
};

interface OverdueTask {
  id: string;
  title: string;
  due_date: string;
}

const fetchOverdueTasks = async (userId: string): Promise<OverdueTask[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, due_date")
    .eq("user_id", userId)
    .eq("overdue", true)
    .eq("is_completed", false)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data || [];
};

const Dashboard: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const userName = session?.user?.user_metadata?.first_name || "Usuário";

  const { data: allTasks = [], isLoading: isLoadingTasks, error: errorTasks, refetch: refetchTasks } = useQuery<Task[], Error>({
    queryKey: ["allTasks", userId],
    queryFn: () => fetchTasks(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 1,
  });
  
  const { data: overdueTasks = [], isLoading: isLoadingOverdue, refetch: refetchOverdue } = useQuery<OverdueTask[], Error>({
    queryKey: ["overdueTasks", userId],
    queryFn: () => fetchOverdueTasks(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
  
  const { todayHabits, isLoading: isLoadingHabits, error: errorHabits, refetch: refetchHabits } = useTodayHabits();
  
  const [isTaskFormOpen, setIsTaskFormOpen] = React.useState(false);

  React.useEffect(() => {
    if (errorTasks) {
      showError("Erro ao carregar tarefas: " + errorTasks.message);
    }
    if (errorHabits) {
      showError("Erro ao carregar hábitos: " + errorHabits.message);
    }
  }, [errorTasks, errorHabits]);

  const handleTaskUpdated = () => {
    refetchTasks();
    refetchOverdue();
    setIsTaskFormOpen(false);
  };
  
  const handleHabitUpdated = () => {
    refetchHabits();
  };

  const dashboardTasks = allTasks.filter(task => !task.is_completed);

  if (isLoadingTasks || isLoadingHabits || isLoadingOverdue) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando seu dia...
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {/* Faixa de Alertas (Fora do Wrapper para ocupar 100% da largura da tela, mas com padding interno) */}
      {overdueTasks.length > 0 && (
        <DashboardWrapper>
          <OverdueTasksReminder 
            tasks={overdueTasks.map(t => ({ 
              id: t.id, 
              title: t.title, 
              due_date: t.due_date ? format(new Date(t.due_date), 'dd/MM') : 'N/A' 
            }))} 
            onTaskUpdated={handleTaskUpdated}
          />
        </DashboardWrapper>
      )}

      {/* Conteúdo Principal (Dentro do Wrapper) */}
      <DashboardWrapper>
        <div className="space-y-6 py-6">
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

          {/* Seção de Listas de Tarefas (Grid 1x, 2x, 3x) */}
          <h2 className="text-xl font-bold text-foreground pt-4 border-t border-border">Seu Fluxo de Trabalho</h2>
          {/* Ajuste do Grid: 1 coluna (mobile), 2 colunas (md), 3 colunas (lg) */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* Quadro de Hábitos */}
            <HabitListBoard 
              habits={todayHabits || []} 
              isLoading={isLoadingHabits} 
              error={errorHabits} 
              refetchHabits={handleHabitUpdated} 
            />
            
            {BOARD_DEFINITIONS.map((board) => (
              <TaskListBoard
                key={board.id}
                title={board.title}
                tasks={dashboardTasks.filter(t => 
                  t.current_board === board.id
                )}
                isLoading={isLoadingTasks}
                error={errorTasks}
                refetchTasks={handleTaskUpdated}
                quickAddTaskInput={
                  <QuickAddTaskInput
                    originBoard={board.id}
                    onTaskAdded={handleTaskUpdated}
                    dueDate={new Date()}
                  />
                }
                originBoard={board.id}
              />
            ))}
          </div>
          
          {/* Seção de Resumos (Produtividade) */}
          <h2 className="text-xl font-bold text-foreground pt-4">Métricas de Produtividade</h2>
          <DashboardResultsSummary />
        </div>
      </DashboardWrapper>
    </div>
  );
};

export default Dashboard;