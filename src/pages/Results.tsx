"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Task, DAYS_OF_WEEK_MAP } from "@/types/task";
import { format, isToday, isThisWeek, isThisMonth, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay, differenceInDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, TrendingUp, CalendarDays, AlertCircle, Repeat } from "lucide-react";
import { showError } from "@/utils/toast";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import MotivationalQuoteCard from "@/components/results/MotivationalQuoteCard";
import GoalsProgress from "@/components/results/GoalsProgress";

interface Profile {
  points: number;
}

const fetchAllTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, is_completed, completed_at, due_date, recurrence_type, recurrence_details, is_daily_recurring, recurrence_streak, recurrence_failure_history
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data as Task[] || [];
};

const fetchProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("points")
    .eq("id", userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
};

const Results: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: allTasks = [], isLoading: isLoadingTasks, error: errorAllTasks } = useQuery<Task[], Error>({
    queryKey: ["allTasksResults", userId],
    queryFn: () => fetchAllTasks(userId!),
    enabled: !!userId,
  });

  const { data: profile, isLoading: isLoadingProfile, error: errorProfile } = useQuery<Profile | null, Error>({
    queryKey: ["profileResults", userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });

  const isLoading = isLoadingTasks || isLoadingProfile;

  if (errorAllTasks || errorProfile) {
    showError("Erro ao carregar resultados: " + (errorAllTasks || errorProfile)?.message);
  }

  // --- Métricas de Conclusão ---
  const today = new Date();
  const startOfToday = format(today, 'yyyy-MM-dd');
  const startOfThisWeek = format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
  const startOfThisMonth = format(startOfMonth(today), 'yyyy-MM-dd');

  const completedToday = allTasks.filter(t => t.completed_at && format(new Date(t.completed_at), 'yyyy-MM-dd') === startOfToday).length;
  const completedThisWeek = allTasks.filter(t => t.completed_at && new Date(t.completed_at) >= new Date(startOfThisWeek)).length;
  const completedThisMonth = allTasks.filter(t => t.completed_at && new Date(t.completed_at) >= new Date(startOfMonth(today))).length;
  
  const totalTasks = allTasks.length;
  const totalCompleted = allTasks.filter(t => t.is_completed).length;
  const completionRate = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;

  // --- Métricas de Recorrência Diária ---
  const dailyRecurringTasks = allTasks.filter(t => t.is_daily_recurring);
  const totalDailyTasks = dailyRecurringTasks.length;
  const dailyTasksCompletedToday = dailyRecurringTasks.filter(t => t.is_completed && t.last_completion_date === startOfToday).length;
  const dailyCompletionRateToday = totalDailyTasks > 0 ? (dailyTasksCompletedToday / totalDailyTasks) * 100 : 0;

  // --- Renderização ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando resultados...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-foreground mb-6">Mural de Auto-Feedback</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Acompanhe seu progresso, celebre suas conquistas e mantenha-se motivado.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <MotivationalQuoteCard />
        <GoalsProgress />
      </div>

      {/* Pontos e Taxa Geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-card border-border shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pontos de Produtividade</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{profile?.points || 0}</div>
            <p className="text-xs text-muted-foreground">Recompensas por concluir tarefas.</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa Geral de Conclusão</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{completionRate.toFixed(0)}%</div>
            <Progress value={completionRate} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recorrentes Diárias (Hoje)</CardTitle>
            <Repeat className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${dailyCompletionRateToday === 100 ? "text-green-500" : "text-red-500"}`}>
              {dailyTasksCompletedToday} / {totalDailyTasks}
            </div>
            <Progress value={dailyCompletionRateToday} className="mt-2 h-2" indicatorClassName={dailyCompletionRateToday === 100 ? "bg-green-500" : "bg-red-500"} />
          </CardContent>
        </Card>
      </div>

      {/* Resumo por Período */}
      <h2 className="text-2xl font-bold text-foreground mb-4">Resumo de Conclusões</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-card border-border shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas Hoje</CardTitle>
            <CalendarDays className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{completedToday}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas Esta Semana</CardTitle>
            <CalendarDays className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{completedThisWeek}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-sm frosted-glass card-hover-effect">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas Este Mês</CardTitle>
            <CalendarDays className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{completedThisMonth}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tarefas Recorrentes Diárias (Streaks) */}
      <h2 className="text-2xl font-bold text-foreground mb-4">Streaks de Recorrência Diária</h2>
      <div className="space-y-3">
        {dailyRecurringTasks.length > 0 ? (
          dailyRecurringTasks.map(task => (
            <Card key={task.id} className="bg-card border-border shadow-sm p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Repeat className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{task.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {task.recurrence_streak > 0 ? `Streak atual: ${task.recurrence_streak} dias` : "Streak quebrado."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {task.is_completed && task.last_completion_date === startOfToday ? (
                  <Badge className="bg-green-500 text-white">Concluída Hoje</Badge>
                ) : (
                  <Badge variant="destructive">Pendente Hoje</Badge>
                )}
              </div>
            </Card>
          ))
        ) : (
          <p className="text-muted-foreground">Nenhuma tarefa recorrente diária configurada.</p>
        )}
      </div>
    </div>
  );
};

export default Results;