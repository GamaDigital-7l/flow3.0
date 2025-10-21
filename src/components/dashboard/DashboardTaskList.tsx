import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { isToday } from "date-fns";
import { Task, TaskOriginBoard } from "@/types/task";
import TaskListBoard from "./dashboard/TaskListBoard";
import { formatDateTime } from "@/lib/utils";
import QuickAddTaskInput from "@/components/QuickAddTaskInput";
import DailyRecurrencesBoard from "@/components/dashboard/DashboardRecurrences";
import ClientTasksBoard from "@/components/dashboard/ClientTasksBoard";
import DashboardResultsSummary from "@/components/dashboard/DashboardResultsSummary";
import DashboardFinanceSummary from "@/components/dashboard/DashboardFinanceSummary";
import { showError } from "@/utils/toast";

// Define BOARD_DEFINITIONS
const BOARD_DEFINITIONS = [
  { id: "overdue", title: "Atrasadas", color: "bg-red-500" },
  { id: "today_high_priority", title: "Hoje (Alta)", color: "bg-red-400" },
  { id: "today_medium_priority", title: "Hoje (Média)", color: "bg-orange-400" },
  { id: "week_low_priority", title: "Semana (Baixa)", color: "bg-yellow-500" },
];

// Placeholder fetch function (assuming it exists elsewhere)
const fetchTasks = async (userId: string): Promise<Task[]> => {
  // Simplified fetch logic for TS resolution
  const { data, error } = await supabase.from("tasks").select("*").eq("user_id", userId);
  if (error) throw error;
  return data || [];
};

const DashboardTaskList: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  
  const userName = session?.user?.user_metadata?.full_name?.split(' ')[0] || 'Usuário';
  const greeting = "Olá"; // Simplified greeting logic

  const { data: allTasks = [], isLoading: isLoadingTasks, error: errorTasks, refetch: refetchTasks } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", userId],
    queryFn: () => fetchTasks(userId!),
    enabled: !!userId,
  });

  React.useEffect(() => {
    if (errorTasks) {
      showError("Erro ao carregar tarefas: " + errorTasks.message);
    }
  }, [errorTasks]);

  const handleTaskUpdated = () => {
    refetchTasks();
  };

  const overdueTasks = allTasks.filter(t => t.current_board === 'overdue' && !t.is_completed);
  const tasksForToday = allTasks.filter(t => !t.is_completed && t.due_date && isToday(new Date(t.due_date)));
  const regularTasks = allTasks.filter(t => t.current_board !== 'overdue' && t.current_board !== 'client_tasks' && !t.is_daily_recurring);

  if (isLoadingTasks) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando seu dia...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{greeting}, {userName}!</h1>
        <p className="text-muted-foreground">
          Seu resumo de tarefas e metas para hoje.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {BOARD_DEFINITIONS.map((board) => (
          <TaskListBoard
            key={board.id}
            boardId={board.id as TaskOriginBoard}
            title={board.title}
            tasks={regularTasks.filter(t => t.current_board === board.id && !t.is_completed)}
            isLoading={isLoadingTasks}
            error={errorTasks}
            refetchTasks={handleTaskUpdated}
          >
            {board.id !== "overdue" && (
                <QuickAddTaskInput
                  originBoard={board.id as TaskOriginBoard}
                  onTaskAdded={handleTaskUpdated}
                />
            )}
          </TaskListBoard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyRecurrencesBoard refetchAllTasks={handleTaskUpdated} />
        <ClientTasksBoard refetchAllTasks={handleTaskUpdated} />
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">Resultados e Progresso</h2>
        <DashboardResultsSummary />
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground mb-4">Resumo Financeiro do Mês</h2>
        <DashboardFinanceSummary />
      </div>
    </div>
  );
};

export default DashboardTaskList;