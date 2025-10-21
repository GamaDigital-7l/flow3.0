"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Task } from "@/types/task";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Repeat, Loader2, CheckCircle2 } from "lucide-react";
import TaskItem from "@/components/TaskItem";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface DailyRecurrencesBoardProps {
  refetchAllTasks: () => void;
}

const fetchDailyRecurringTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, is_completed, recurrence_streak, recurrence_time,
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

const DailyRecurrencesBoard: React.FC<DailyRecurrencesBoardProps> = ({ refetchAllTasks }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: recurringTasks, isLoading, error, refetch } = useQuery<Task[], Error>({
    queryKey: ["dailyRecurringTasksDashboard", userId],
    queryFn: () => fetchDailyRecurringTasks(userId!),
    enabled: !!userId,
  });

  const pendingTasks = recurringTasks?.filter(task => !task.is_completed) || [];

  return (
    <Card className="w-full bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Repeat className="h-5 w-5 text-purple-500" /> Recorrentes Diárias
        </CardTitle>
        <Link to="/recurring">
          <Button variant="ghost" size="sm" className="text-sm text-primary hover:bg-primary/10">
            Gerenciar
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="text-red-500 text-sm">Erro ao carregar recorrentes.</p>
        ) : pendingTasks.length === 0 ? (
          <div className="text-center py-4">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-muted-foreground font-semibold">Parabéns! Todas as recorrentes de hoje foram concluídas.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                refetchTasks={() => {
                  refetch();
                  refetchAllTasks();
                }}
                isDailyRecurringView={true}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyRecurrencesBoard;