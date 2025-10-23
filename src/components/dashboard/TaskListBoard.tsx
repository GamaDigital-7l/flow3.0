"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, AlertCircle } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { Task, TaskOriginBoard } from "@/types/task"; // Importar Task e TaskOriginBoard
import TaskItem from "@/components/TaskItem"; // Import TaskItem
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils"; // Importando as novas funções

interface TaskListBoardProps {
  title: string;
  tasks: Task[];
  isLoading: boolean;
  error: Error | null;
  refetchTasks: () => void;
  quickAddTaskInput?: React.ReactNode;
  originBoard?: TaskOriginBoard;
  selectedDate?: Date; // Nova prop
}

const TaskListBoard: React.FC<TaskListBoardProps> = ({
  title,
  tasks,
  isLoading,
  error,
  refetchTasks,
  quickAddTaskInput,
  originBoard = "general",
  selectedDate, // Recebe a data selecionada
}) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

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

  const taskTree = React.useMemo(() => buildTaskTree(tasks), [tasks, buildTaskTree]);

  const overdueCount = tasks.filter(task => task.overdue).length;

  if (isLoading) {
    return (
      <Card className="w-full bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <p className="text-muted-foreground text-sm">Carregando tarefas...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <p className="text-red-500 text-sm">Erro ao carregar tarefas: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-1 flex-wrap gap-1">
        <div className="flex items-center gap-1 min-w-0">
          <CardTitle className="text-base font-semibold text-foreground break-words">{title}</CardTitle>
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-500 flex-shrink-0">
              <AlertCircle className="h-3 w-3" /> {overdueCount}
            </span>
          )}
        </div>
        {quickAddTaskInput && <div className="w-full">{quickAddTaskInput}</div>}
      </CardHeader>
      <CardContent className="p-2 pt-1">
        {taskTree.length === 0 ? (
          <p className="text-muted-foreground text-xs">Nenhuma tarefa encontrada para este quadro.</p>
        ) : (
          <div className="space-y-1">
            {taskTree.map((task) => (
              <TaskItem key={task.id} task={task} refetchTasks={refetchTasks} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TaskListBoard;