"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useSession } from "@/integrations/supabase/auth";
import { Task, TaskOriginBoard } from "@/types/task"; // Importar Task e TaskOriginBoard
import TaskListBoard from "./dashboard/TaskListBoard"; // Importar o componente reutilizável
import { formatDateTime } from "@/lib/utils"; // Importando as novas funções

const fetchAllTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
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
  })) || [];
  return mappedData;
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return "Bom dia";
  }
  if (hour >= 12 && hour < 18) {
    return "Boa tarde";
  }
  return "Boa noite";
};

const Dashboard: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: allTasks, isLoading, error, refetch } = useQuery<Task[], Error>({
    queryKey: ["allTasks", userId],
    queryFn: () => fetchAllTasks(userId!),
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

  const greeting = getGreeting();
  const regularTasks = allTasks.filter(task => !task.is_daily_recurring && task.current_board !== 'client_tasks');
  const overdueTasks = allTasks.filter(t => t.current_board === 'overdue' && !t.is_completed);
  const tasksForToday = allTasks.filter(t => !t.is_completed && t.due_date && isToday(new Date(t.due_date)));

  if (isLoadingTasks) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando seu dia...
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{greeting}, {userName}!</h1>
        <p className="text-muted-foreground">
          Hoje você tem {tasksForToday.length} tarefas agendadas e {overdueTasks.length} pendências. Vamos organizar o dia!
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {BOARD_DEFINITIONS.map((board) => (
          <TaskListBoard
            key={board.id}
            title={board.title}
            tasks={regularTasks.filter(t => t.current_board === board.id && !t.is_completed)}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyRecurrencesBoard refetchAllTasks={handleTaskUpdated} />
        <ClientTasksBoard refetchAllTasks={handleTaskUpdated} />
      </div>

      <DashboardResultsSummary />
      
      <div className="mt-6">
        <h2 className="text-2xl font-bold text-foreground mb-4">Resumo Financeiro do Mês</h2>
        <DashboardFinanceSummary />
      </div>
    </div>
  );
};

export default Dashboard;