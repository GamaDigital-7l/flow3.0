"use client";

import React, { useEffect } from "react";
import TaskForm from "@/components/TaskForm";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { getDay, isToday, isThisWeek, isThisMonth, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Trash2, Repeat, Clock, Edit, PlusCircle, BookOpen, Dumbbell, GraduationCap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useSession } from "@/integrations/supabase/auth";
import { Badge } from "@/components/ui/badge";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers";
import { Task, Tag, DAYS_OF_WEEK_MAP, DAYS_OF_WEEK_LABELS, TemplateTask, TemplateFormOriginBoard } from "@/types/task";
import TaskItem from "@/components/TaskItem";
import TemplateTaskForm from "@/components/TemplateTaskForm";
import TemplateTaskItem from "@/components/TemplateTaskItem";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import PullToRefresh from "@/components/PullToRefresh"; // Importar PullToRefresh
import QuickAddTaskInput from "@/components/dashboard/QuickAddTaskInput"; // Importar QuickAddTaskInput

const fetchTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      last_successful_completion_date, origin_board, current_board, is_priority, overdue, parent_task_id, created_at, completed_at, updated_at,
      is_daily_recurring, recurrence_streak, recurrence_failure_history,
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

// Removendo fetchTemplateTasks, pois a gestão de templates será movida para outro lugar ou simplificada.
// Por enquanto, a gestão de recorrentes diárias está em /recurring.

const Tasks: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const { data: tasks, isLoading, error, refetch } = useQuery<Task[], Error>({
    queryKey: ["tasks", userId],
    queryFn: () => fetchTasks(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | undefined>(undefined);

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) {
        throw new Error("Usuário não autenticado.");
      }
      const { data: taskToUpdate, error: fetchTaskError } = await supabase
        .from("tasks")
        .select("recurrence_type, origin_board, current_board, is_priority, overdue, is_daily_recurring, recurrence_streak, recurrence_failure_history")
        .eq("id", taskId)
        .single();

      if (fetchTaskError) throw fetchTaskError;

      let newCurrentBoard = taskToUpdate.current_board;
      let newOverdueStatus = taskToUpdate.overdue;
      let completedAt = new Date().toISOString();
      let lastSuccessfulCompletionDate = new Date().toISOString().split('T')[0];
      let newStreak = taskToUpdate.recurrence_streak;
      let newFailureHistory = taskToUpdate.recurrence_failure_history;
      
      if (taskToUpdate.is_daily_recurring) {
        newStreak = (taskToUpdate.recurrence_streak || 0) + 1;
        newFailureHistory = taskToUpdate.recurrence_failure_history?.filter(d => d !== lastSuccessfulCompletionDate) || [];
      } else if (taskToUpdate.recurrence_type === "none") {
        newCurrentBoard = "completed";
        newOverdueStatus = false;
      }

      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          is_completed: true,
          updated_at: new Date().toISOString(),
          last_successful_completion_date: lastSuccessfulCompletionDate,
          completed_at: completedAt,
          current_board: newCurrentBoard,
          overdue: newOverdueStatus,
          recurrence_streak: newStreak,
          last_completion_date: lastSuccessfulCompletionDate,
          recurrence_failure_history: newFailureHistory,
        })
        .eq("id", taskId)
        .eq("user_id", userId);

      if (updateError) throw updateError;

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
      const { error: pointsError } = await supabase
        .from("profiles")
        .update({ points: newPoints, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (pointsError) throw pointsError;
    },
    onSuccess: () => {
      showSuccess("Tarefa concluída com sucesso!");
      handleTaskUpdated();
    },
    onError: (err: any) => {
      showError("Erro ao concluir tarefa: " + err.message);
      console.error("Erro ao concluir tarefa:", err);
    },
  });

  useEffect(() => {
    const taskIdToComplete = searchParams.get('complete_task_id');
    if (taskIdToComplete && userId) {
      completeTaskMutation.mutate(taskIdToComplete);
      searchParams.delete('complete_task_id');
      navigate({ search: searchParams.toString() }, { replace: true });
    }
  }, [searchParams, userId, navigate, completeTaskMutation]);

  const handleTaskUpdated = () => {
    refetch(); 
    queryClient.invalidateQueries({ queryKey: ["dashboardTasks", userId] }); 
    queryClient.invalidateQueries({ queryKey: ["allTasks", userId] }); 
    queryClient.invalidateQueries({ queryKey: ["dailyPlannerTasks", userId] }); 
    queryClient.invalidateQueries({ queryKey: ["dailyRecurringTasks", userId] }); // Invalida o novo dashboard
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta tarefa?")) {
      try {
        await supabase.from("task_tags").delete().eq("task_id", taskId);

        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", taskId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Tarefa deletada com sucesso!");
        handleTaskUpdated(); 
      } catch (err: any) {
        showError("Erro ao deletar tarefa: " + err.message);
        console.error("Erro ao deletar tarefa:", err);
      }
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const filterTasks = (task: Task, filterType: "weekly" | "monthly" | "all") => {
    const today = new Date();
    const currentDayOfWeek = getDay(today);
    const currentDayOfMonth = today.getDate().toString();

    const isDayIncluded = (details: string | null | undefined, dayIndex: number) => {
      if (!details) return false;
      const days = details.split(',');
      return days.some(day => DAYS_OF_WEEK_MAP[day] === dayIndex);
    };

    // Excluir tarefas diárias inegociáveis e concluídas/atrasadas
    if (task.is_daily_recurring || task.is_completed || task.current_board === "completed" || task.current_board === "overdue") return false;

    if (task.recurrence_type !== "none") {
      switch (filterType) {
        case "weekly":
          return task.recurrence_type === "daily" || (task.recurrence_type === "weekly" && isDayIncluded(task.recurrence_details, currentDayOfWeek));
        case "monthly":
          return task.recurrence_type === "daily" || (task.recurrence_type === "weekly" && isDayIncluded(task.recurrence_details, currentDayOfWeek)) || (task.recurrence_type === "monthly" && task.recurrence_details === currentDayOfMonth);
        case "all":
        default:
          return true;
      }
    }

    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);

    switch (filterType) {
      case "weekly":
        return isThisWeek(dueDate, { weekStartsOn: 0 });
      case "monthly":
        return isThisMonth(dueDate);
      case "all":
      default:
        return true;
    }
  };

  const buildTaskTree = React.useCallback((allTasks: Task[]): Task[] => {
    const taskMap = new Map<string, Task>();
    allTasks.forEach(task => {
      taskMap.set(task.id, { ...task, subtasks: [] });
    });

    const rootTasks: Task[] = [];
    allTasks.forEach(task => {
      if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
        taskMap.get(task.parent_task_id)?.subtasks?.push(taskMap.get(task.id)!);
      } else {
        rootTasks.push(taskMap.get(task.id)!);
      }
    });

    rootTasks.forEach(task => {
      if (task.subtasks) {
        task.subtasks.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    });

    return rootTasks.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, []);

  const taskTree = React.useMemo(() => buildTaskTree(tasks || []), [tasks, buildTaskTree]);

  const renderTaskList = (filteredTasks: Task[]) => {
    const filteredTaskTree = React.useMemo(() => buildTaskTree(filteredTasks), [filteredTasks, buildTaskTree]);
    if (filteredTaskTree.length === 0) {
      return <p className="text-muted-foreground">Nenhuma tarefa encontrada para esta categoria.</p>;
    }
    return (
      <div className="space-y-3">
        {filteredTaskTree.map((task) => (
          <TaskItem key={task.id} task={task} refetchTasks={handleTaskUpdated} />
        ))}
      </div>
    );
  };

  // Função para o PullToRefresh
  const handleRefresh = async () => {
    await refetch();
    showSuccess("Tarefas atualizadas!");
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando tarefas...</p>;
  if (error) return <p className="text-red-500">Erro ao carregar tarefas: {error.message}</p>;

  const weeklyTasks = tasks?.filter((task) => filterTasks(task, "weekly")) || [];
  const monthlyTasks = tasks?.filter((task) => filterTasks(task, "monthly")) || [];
  const allNonDailyRecurringTasks = tasks?.filter(t => !t.is_daily_recurring) || [];

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="flex flex-1 flex-col gap-4 p-3 md:p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2">
          <h1 className="text-3xl font-bold text-foreground">Suas Tarefas</h1>
          <Dialog
            open={isFormOpen}
            onOpenChange={(open) => {
              setIsFormOpen(open);
              if (!open) setEditingTask(undefined);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setEditingTask(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">{editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {editingTask ? "Atualize os detalhes da sua tarefa." : "Crie uma nova tarefa para organizar seu dia."}
                </DialogDescription>
              </DialogHeader>
              <TaskForm
                initialData={editingTask ? { ...editingTask, due_date: editingTask.due_date ? new Date(editingTask.due_date) : undefined } : undefined}
                onTaskSaved={handleTaskUpdated}
                onClose={() => setIsFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-lg text-muted-foreground">
          Organize suas tarefas pontuais e recorrentes (não diárias) aqui.
        </p>

        <QuickAddTaskInput originBoard="general" onTaskAdded={handleTaskUpdated} />

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
            <CardHeader>
              <CardTitle className="text-foreground">Gerenciamento de Tarefas</CardTitle>
              <CardDescription className="text-muted-foreground">
                Para tarefas diárias inegociáveis, use a seção <Link to="/recurring" className="text-primary hover:underline">Recorrentes</Link>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-secondary/50 border border-border rounded-md">
                  <TabsTrigger value="weekly" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Semanais</TabsTrigger>
                  <TabsTrigger value="monthly" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Mensais</TabsTrigger>
                  <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:border-primary/50 rounded-md">Todas</TabsTrigger>
                </TabsList>
                <div className="mt-4">
                  <TabsContent value="weekly">{renderTaskList(weeklyTasks)}</TabsContent>
                  <TabsContent value="monthly">{renderTaskList(monthlyTasks)}</TabsContent>
                  <TabsContent value="all">{renderTaskList(allNonDailyRecurringTasks)}</TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </PullToRefresh>
  );
};

export default Tasks;