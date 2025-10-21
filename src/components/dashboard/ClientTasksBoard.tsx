"use client";

import React, { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess, showInfo, dismissToast } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ListTodo, Loader2, Users, CheckCircle2 } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { Task } from "@/types/task";
import TaskItem from "@/components/TaskItem";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";

interface ClientTasksBoardProps {
  refetchAllTasks: () => void;
}

const fetchClientTasksFromDashboard = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      last_successful_completion_date, origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, updated_at,
      task_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId)
    .eq("current_board", "client_tasks") // Filtrar pelo board de clientes
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

const ClientTasksBoard: React.FC<ClientTasksBoardProps> = ({ refetchAllTasks }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: clientTasks, isLoading, error, refetch } = useQuery<Task[], Error>({
    queryKey: ["dashboardTasks", "client_tasks", userId],
    queryFn: () => fetchClientTasksFromDashboard(userId!),
    enabled: !!userId,
  });

  const handleTaskCompletion = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");

      // Apenas marca como concluída no Dashboard (is_completed = true) e move para 'completed'
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          is_completed: true,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          current_board: "completed", // Move para o status de concluída no Dashboard
        })
        .eq("id", taskId)
        .eq("user_id", userId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      showSuccess("Tarefa de cliente concluída no Dashboard!");
      refetch();
      refetchAllTasks(); // Refetch do Dashboard principal
    },
    onError: (err: any) => {
      showError("Erro ao concluir tarefa de cliente: " + err.message);
    },
  });

  const handleOpenClientTask = async (task: Task) => {
    if (task.client_name) {
        const loadingToast = showInfo(`Buscando cliente ${task.client_name}...`);
        try {
            const { data: clientData, error: clientError } = await supabase.from('clients').select('id').eq('user_id', userId!).eq('name', task.client_name).single();
            dismissToast(loadingToast as any);
            if (clientError || !clientData) {
                showError(`Cliente "${task.client_name}" não encontrado.`);
            } else {
                navigate(`/clients/${clientData.id}?openTaskId=${task.id}`);
            }
        } catch (err: any) {
            dismissToast(loadingToast as any);
            showError("Erro ao buscar cliente: " + err.message);
        }
    } else {
        showError("Nome do cliente não encontrado para esta tarefa.");
    }
  };

  const tasksToDisplay = clientTasks?.filter(t => t.current_board === 'client_tasks' && !t.is_completed) || [];

  return (
    <Card className="w-full bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-500" /> Tarefas de Clientes
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {tasksToDisplay.length} pendentes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando tarefas de clientes...</p>
        ) : tasksToDisplay.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma tarefa de cliente pendente no Dashboard.</p>
        ) : (
          <div className="space-y-3">
            {tasksToDisplay.map((task) => (
              <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                <Checkbox
                  id={`client-dash-task-${task.id}`}
                  checked={task.is_completed}
                  onCheckedChange={(checked) => handleTaskCompletion.mutate(task.id)}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0 mt-1"
                  disabled={handleTaskCompletion.isPending}
                />
                <div className="flex-grow min-w-0">
                  <label
                    htmlFor={`client-dash-task-${task.id}`}
                    className={cn(
                      "font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 break-words text-sm md:text-base",
                      task.is_completed ? "line-through text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {task.title.replace('[CLIENTE] ', '')}
                  </label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {task.client_name && (
                        <Badge variant="secondary" className="bg-blue-500/20 text-blue-500 border-blue-500/50">
                            Cliente: {task.client_name}
                        </Badge>
                    )}
                    {task.due_date && (
                        <Badge variant="secondary" className="bg-gray-500/20 text-gray-500 border-gray-500/50">
                            Vencimento: {format(new Date(task.due_date), "dd/MM")}
                        </Badge>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleOpenClientTask(task)} className="h-7 px-2 text-blue-500 hover:bg-blue-500/10 flex-shrink-0">
                    <Users className="h-4 w-4 mr-1" /> Ver Kanban
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientTasksBoard;