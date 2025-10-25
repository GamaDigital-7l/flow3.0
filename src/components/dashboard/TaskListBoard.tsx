"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, ArrowRight, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useSession } from "@/integrations/supabase/auth";
import { Task, TaskOriginBoard } from "@/types/task"; // Importar Task e TaskOriginBoard
import TaskItem from "@/components/TaskItem"; // Import TaskItem
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils"; // Importando as novas funções
import { Skeleton } from "@/components/ui/skeleton";

interface TaskListBoardProps {
  title: string;
  tasks: Task[];
  isLoading: boolean;
  error: Error | null;
  refetchTasks: () => void;
  quickAddTaskInput?: React.ReactNode;
  originBoard?: TaskOriginBoard;
}

const TaskListBoard: React.FC<TaskListBoardProps> = React.memo(({
  title,
  tasks,
  isLoading,
  error,
  refetchTasks,
  quickAddTaskInput,
  originBoard = "general",
}) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  // Memoizando a construção da árvore de tarefas
  const buildTaskTree = React.useCallback((allTasks: Task[]): Task[] => {
    const taskMap = new Map<string, Task>();
    allTasks.forEach(task => {
      // Clonar a tarefa para adicionar subtasks sem modificar o array original
      taskMap.set(task.id, { ...task, subtasks: [] });
    });

    const rootTasks: Task[] = [];
    allTasks.forEach(task => {
      const currentTask = taskMap.get(task.id);
      if (!currentTask) return;

      if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
        // Adicionar a subtarefa ao array de subtasks do pai
        taskMap.get(task.parent_task_id)?.subtasks?.push(currentTask);
      } else {
        rootTasks.push(currentTask);
      }
    });

    // Ordenar subtasks e root tasks
    rootTasks.forEach(task => {
      if (task.subtasks) {
        task.subtasks.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    });

    return rootTasks.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, []); // Dependências vazias, pois a lógica é pura

  const taskTree = React.useMemo(() => buildTaskTree(tasks), [tasks, buildTaskTree]);

  const overdueCount = tasks.filter(task => task.overdue).length;

  // --- Dynamic Layout Logic ---
  // Usando classes responsivas para padding e espaçamento
  const contentPaddingClass = "p-2 pt-1";
  const itemSpacingClass = "space-y-1";
  // --- End Dynamic Layout Logic ---

  if (isLoading) {
    return (
      <Card className="w-full bg-card border border-border rounded-xl shadow-sm card-hover-effect">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="flex flex-col space-y-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full bg-card border border-border rounded-xl shadow-sm card-hover-effect">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-1 flex-wrap gap-1 flex-shrink-0">
          <div className="flex items-center gap-1 min-w-0">
            <CardTitle className="text-base font-semibold text-foreground break-words">{title}</CardTitle>
            <span className="flex items-center gap-1 text-xs text-red-500 flex-shrink-0">
              <AlertTriangle className="h-3 w-3" /> Erro
            </span>
          </div>
          {/* QuickAddTaskInput ocupa a largura total no mobile */}
          {quickAddTaskInput && <div className="w-full">{quickAddTaskInput}</div>}
        </CardHeader>
        <CardContent className="p-3">
          <p className="text-red-500 text-sm">Erro ao carregar tarefas: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-card border border-border rounded-xl shadow-sm card-hover-effect flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-1 flex-wrap gap-1 flex-shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          <CardTitle className="text-base font-semibold text-foreground break-words">{title}</CardTitle>
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-500 flex-shrink-0">
              <AlertTriangle className="h-3 w-3" /> {overdueCount}
            </span>
          )}
        </div>
        {/* QuickAddTaskInput ocupa a largura total no mobile */}
        {quickAddTaskInput && <div className="w-full">{quickAddTaskInput}</div>}
      </CardHeader>
      
      {/* Aplicando altura máxima e scroll interno */}
      <div className="max-h-[85vh] overflow-y-auto custom-scrollbar flex-1">
        <CardContent className={contentPaddingClass}>
          {taskTree.length === 0 ? (
            <p className="text-muted-foreground text-xs p-2">Nenhuma tarefa encontrada para este quadro.</p>
          ) : (
            <div className={itemSpacingClass}>
              {taskTree.map((task) => (
                <TaskItem key={task.id} task={task} refetchTasks={refetchTasks} compactMode={true} />
              ))}
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
});

export default TaskListBoard;