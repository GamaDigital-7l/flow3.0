"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Task, TaskCurrentBoard } from '@/types/task';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, CalendarDays } from "lucide-react";
import { format, isBefore, startOfDay, parseISO } from "date-fns";
import { cn, formatDateTime } from "@/lib/utils";

interface OverdueTasksReminderProps {
  onTaskUpdated: () => void;
}

const fetchOverdueTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("is_completed", false)
    .lt("due_date", format(startOfDay(new Date()), "yyyy-MM-dd"))
    .order("due_date", { ascending: true });

  if (error) {
    throw error;
  }
  return data as Task[] || [];
};

const OverdueTasksReminder: React.FC<OverdueTasksReminderProps> = ({ onTaskUpdated }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: overdueTasks, isLoading, error } = useQuery<Task[], Error>({
    queryKey: ["overdueTasks", userId],
    queryFn: () => fetchOverdueTasks(userId!),
    enabled: !!userId,
  });

  if (!overdueTasks || overdueTasks.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#1A1C1F] text-[#E6E6E6] p-4 rounded-md mb-4">
      <h2 className="text-lg font-semibold text-primary">
        <AlertCircle className="inline-block mr-2 h-5 w-5 animate-pulse" />
        Tarefas Atrasadas
      </h2>
      {overdueTasks.map(task => (
        <div key={task.id} className="flex items-center justify-between py-2 border-b border-[#333] last:border-b-0">
          <div>
            <p className="font-semibold">{task.title}</p>
            <p className="text-sm text-muted-foreground">
              {task.origin_board} - {formatDateTime(task.due_date)}
            </p>
          </div>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
            <CheckCircle2 className="mr-2 h-4 w-4" /> Concluir
          </Button>
        </div>
      ))}
    </div>
  );
};

export default OverdueTasksReminder;