import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { Task, TaskCurrentBoard } from "@/types/task";
import { cn } from "@/lib/utils";
import { formatDateTime, formatTime, parseISO } from "@/lib/utils";

interface TaskItemProps {
  task: Task;
  refetchTasks: () => void;
  isDailyRecurringView?: boolean;
}

const getTaskDueDateDisplay = (task: Task): string => {
  if (task.due_date) {
    return formatDateTime(task.due_date, false);
  }
  return "Sem data de vencimento";
};

const TaskItem: React.FC<TaskItemProps> = ({ task, refetchTasks, isDailyRecurringView = false }) => {

  return (
    <Card className="p-2 border border-border rounded-lg bg-card shadow-sm transition-all duration-200">
      <div className="flex items-start gap-2">
        <div className="grid gap-0.5 flex-grow min-w-0">
          <label className="text-sm font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70 break-words text-sm">
            {task.title}
          </label>
          {task.description && (
            <p className="text-xs text-muted-foreground break-words line-clamp-1">{task.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <CalendarDays className="h-3 w-3 flex-shrink-0" /> {getTaskDueDateDisplay(task)}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default TaskItem;