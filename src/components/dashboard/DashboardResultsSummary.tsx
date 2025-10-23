"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, CheckCircle2, Repeat, Loader2, CalendarDays } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isToday, isThisWeek, isThisMonth, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { formatDateTime } from '@/lib/utils';

interface Profile {
  points: number;
}

interface TaskMetric {
  id: string;
  is_completed: boolean;
  completed_at: string | null;
  recurrence_type: string;
  recurrence_streak: number; // Assumindo que este campo existe na tabela tasks
}

const fetchMetrics = async (userId: string): Promise<{ profile: Profile | null, tasks: TaskMetric[] }> => {
  const [profileResponse, tasksResponse] = await Promise.all([
    supabase
      .from("profiles")
      .select("points")
      .eq("id", userId)
      .single(),
    supabase
      .from("tasks")
      .select("id, is_completed, completed_at, recurrence_type, recurrence_streak")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false, nullsFirst: true })
  ]);

  if (profileResponse.error && profileResponse.error.code !== 'PGRST116') throw profileResponse.error;
  if (tasksResponse.error) throw tasksResponse.error;

  return {
    profile: profileResponse.data || null,
    tasks: tasksResponse.data as TaskMetric[] || [],
  };
};

const DashboardResultsSummary: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data, isLoading } = useQuery<{ profile: Profile | null, tasks: TaskMetric[] }, Error>({
    queryKey: ["profileDashboardSummary", userId],
    queryFn: () => fetchMetrics(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="frosted-glass">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  const startOfThisWeek = format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd');
  const startOfThisMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const completedToday = data?.tasks.filter(t => t.completed_at && format(new Date(t.completed_at), 'yyyy-MM-dd') === today).length || 0;
  const completedThisWeek = data?.tasks.filter(t => t.completed_at && format(new Date(t.completed_at), 'yyyy-MM-dd') >= startOfThisWeek).length || 0;
  const completedThisMonth = data?.tasks.filter(t => t.completed_at && format(new Date(t.completed_at), 'yyyy-MM-dd') >= startOfThisMonth).length || 0;
  
  // Cálculo do maior streak (assumindo que recurrence_streak existe na tabela tasks)
  const maxStreak = data?.tasks.reduce((max, t) => {
    if (t.recurrence_type === 'daily' && t.recurrence_streak > max) {
      return t.recurrence_streak;
    }
    return max;
  }, 0) || 0;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="frosted-glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pontos de Produtividade</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{data?.profile?.points || 0}</div>
          <p className="text-xs text-muted-foreground">Pontos acumulados.</p>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tarefas Concluídas (Hoje)</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{completedToday}</div>
          <p className="text-xs text-muted-foreground">Concluídas hoje.</p>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tarefas Concluídas (Semana)</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{completedThisWeek}</div>
          <p className="text-xs text-muted-foreground">Concluídas esta semana.</p>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tarefas Concluídas (Mês)</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{completedThisMonth}</div>
          <p className="text-xs text-muted-foreground">Concluídas este mês.</p>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Maior Streak Diário</CardTitle>
          <Repeat className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{maxStreak}</div>
          <p className="text-xs text-muted-foreground">Dias consecutivos.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardResultsSummary;