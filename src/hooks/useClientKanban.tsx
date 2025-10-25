// src/hooks/useClientKanban.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { arrayMove } from '@dnd-kit/sortable';
import { DragEndEvent, UniqueIdentifier } from '@dnd-kit/core';
import { showError, showSuccess, showInfo } from '@/utils/toast';
import { format } from 'date-fns';
import { ClientTaskStatus, Client, ClientTask } from '@/types/client';

// Define KANBAN_COLUMNS here as they are intrinsic to the Kanban logic
export const KANBAN_COLUMNS: { id: ClientTaskStatus; title: string; color: string }[] = [
  { id: "in_progress", title: "Em Produção", color: "text-muted-foreground" },
  { id: "under_review", title: "Para Aprovação", color: "text-primary" },
  { id: "edit_requested", title: "Edição Solicitada", color: "text-primary" },
  { id: "approved", title: "Aprovado", color: "text-foreground" },
  { id: "posted", title: "Postado/Concluído", color: "text-muted-foreground" },
];

const fetchClientData = async (clientId: string, userId: string, monthYearRef: string): Promise<{ client: Client | null, tasks: ClientTask[] }> => {
  const [clientResponse, tasksResponse] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, logo_url")
      .eq("id", clientId)
      .eq("user_id", userId)
      .single(),
    supabase
      .from("client_tasks")
      .select(`
        id, title, description, status, due_date, time, image_urls, public_approval_enabled, edit_reason, client_id, user_id, is_completed, order_index, public_approval_link_id, month_year_reference,
        client_task_tags(
          tags(id, name, color)
        )
      `)
      .eq("client_id", clientId)
      .eq("user_id", userId)
      .eq("month_year_reference", monthYearRef)
      .order("order_index", { ascending: true })
  ]);

  if (clientResponse.error && clientResponse.error.code !== 'PGRST116') throw clientResponse.error;
  if (tasksResponse.error) throw tasksResponse.error;

  const mappedTasks = tasksResponse.data?.map((task: any) => ({
    ...task,
    tags: task.client_task_tags.map((ttt: any) => ttt.tags),
  })) || [];

  return {
    client: clientResponse.data || null,
    tasks: mappedTasks as ClientTask[],
  };
};

export const useClientKanban = (clientId: string) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  
  const [currentMonthYear, setCurrentMonthYear] = useState(format(new Date(), 'yyyy-MM'));
  const [localTasks, setLocalTasks] = useState<ClientTask[]>([]);
  const [activeDragItem, setActiveDragItem] = useState<ClientTask | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["clientTasks", clientId, userId, currentMonthYear],
    queryFn: () => fetchClientData(clientId, userId!, currentMonthYear),
    enabled: !!clientId && !!userId,
    staleTime: 1000 * 60 * 1,
  });

  React.useEffect(() => {
    if (data?.tasks) {
      setLocalTasks(data.tasks);
    }
  }, [data?.tasks]);

  const tasksByStatus = useMemo(() => {
    const map = new Map<ClientTaskStatus, ClientTask[]>();
    KANBAN_COLUMNS.forEach(col => map.set(col.id, []));
    localTasks.forEach(task => {
      map.get(task.status)?.push(task);
    });
    map.forEach(tasks => tasks.sort((a, b) => a.order_index - b.order_index));
    return map;
  }, [localTasks]);

  const updateTaskStatusAndOrder = useMutation({
    mutationFn: async (updates: { taskId: string, newStatus: ClientTaskStatus, newOrderIndex: number }[]) => {
      if (!userId || !clientId) throw new Error("Usuário não autenticado ou cliente inválido.");
      
      const taskIds = updates.map(u => u.taskId);
      const { data: existingTasks, error: fetchError } = await supabase
        .from("client_tasks")
        .select("id, title, month_year_reference, due_date, time, description, image_urls, public_approval_enabled, edit_reason, responsible_id")
        .in("id", taskIds);

      if (fetchError) throw fetchError;
      
      const taskMap = new Map(existingTasks.map(t => [t.id, t]));

      const dbUpdates = updates.map(({ taskId, newStatus, newOrderIndex }) => {
        const existing = taskMap.get(taskId);
        if (!existing) throw new Error(`Task ${taskId} not found for update.`);

        const isCompleted = newStatus === 'approved' || newStatus === 'posted';
        
        return {
          id: taskId,
          user_id: userId,
          client_id: clientId,
          title: existing.title,
          month_year_reference: existing.month_year_reference,
          description: existing.description,
          due_date: existing.due_date,
          time: existing.time,
          image_urls: existing.image_urls,
          public_approval_enabled: existing.public_approval_enabled,
          edit_reason: existing.edit_reason,
          responsible_id: existing.responsible_id,
          
          status: newStatus,
          order_index: newOrderIndex,
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        };
      });
      
      const { error } = await supabase
        .from("client_tasks")
        .upsert(dbUpdates, { onConflict: 'id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId] });
      queryClient.invalidateQueries({ queryKey: ["allTasks", userId] });
    },
    onError: (err: any) => {
      showError("Erro ao mover tarefa: " + err.message);
      refetch();
    },
  });

  const handleDragStart = (event: any) => {
    const activeTask = localTasks.find(t => t.id === event.active.id);
    if (activeTask) {
      setActiveDragItem(activeTask);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);
    
    if (!over) return;

    const activeId = active.id as string;
    const draggedTask = localTasks.find(t => t.id === activeId);
    if (!draggedTask) return;

    let targetContainerId: UniqueIdentifier | null = null;
    let overId: UniqueIdentifier | null = null;

    if (over.data.current?.sortable?.containerId) {
        targetContainerId = over.data.current.sortable.containerId;
        overId = over.id;
    } else {
        targetContainerId = over.id;
        overId = null;
    }

    const sourceStatus = draggedTask.status;
    const targetStatus = targetContainerId as ClientTaskStatus; 
    
    if (!targetStatus) return;

    setLocalTasks(prevTasks => {
      const tasksInSource = prevTasks.filter(t => t.status === sourceStatus).sort((a, b) => a.order_index - b.order_index);
      const tasksInTarget = prevTasks.filter(t => t.status === targetStatus).sort((a, b) => a.order_index - b.order_index);
      
      let newTasksInTarget: ClientTask[] = [...tasksInTarget];
      let newTasksInSource: ClientTask[] = [...tasksInSource];
      
      const updatesToSend: { taskId: string, newStatus: ClientTaskStatus, newOrderIndex: number }[] = [];
      
      if (sourceStatus === targetStatus) {
        const oldIndex = tasksInSource.findIndex(t => t.id === activeId);
        const newIndex = tasksInSource.findIndex(t => t.id === overId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          newTasksInTarget = arrayMove(tasksInSource, oldIndex, newIndex);
        }
        newTasksInSource = [];
      } else {
        newTasksInSource = tasksInSource.filter(t => t.id !== activeId);
        
        const overIndex = overId ? tasksInTarget.findIndex(t => t.id === overId) : -1;
        const insertIndex = overIndex === -1 ? tasksInTarget.length : overIndex;
        
        const taskToMove = { ...draggedTask, status: targetStatus };
        newTasksInTarget.splice(insertIndex, 0, taskToMove);
      }
      
      const finalTasks: ClientTask[] = [];
      
      KANBAN_COLUMNS.forEach(col => {
        let currentList = prevTasks.filter(t => t.status === col.id).sort((a, b) => a.order_index - b.order_index);
        
        if (col.id === sourceStatus && sourceStatus !== targetStatus) {
          currentList = newTasksInSource;
        } else if (col.id === targetStatus) {
          currentList = newTasksInTarget;
        }
        
        currentList.forEach((task, index) => {
          const newStatus = col.id;
          const updatedTask = { ...task, status: newStatus, order_index: index };
          finalTasks.push(updatedTask);
          
          const originalTask = prevTasks.find(t => t.id === task.id);
          if (!originalTask || originalTask.status !== newStatus || originalTask.order_index !== index) {
              updatesToSend.push({
                taskId: task.id,
                newStatus: newStatus,
                newOrderIndex: index,
              });
          }
        });
      });
      
      if (updatesToSend.length > 0) {
          updateTaskStatusAndOrder.mutate(updatesToSend);
      }
      
      return finalTasks;
    });
  };
  
  const handleGenerateApprovalLink = useMutation({
    mutationFn: async () => {
      if (!userId || !clientId) throw new Error("Usuário não autenticado ou cliente inválido.");
      
      const tasksToReview = tasksByStatus.get('under_review') || [];
      if (tasksToReview.length === 0) {
        showInfo("Nenhuma tarefa em 'Para Aprovação' com aprovação pública habilitada.");
        return;
      }
      
      const monthYearRef = tasksToReview[0].month_year_reference;
      if (!monthYearRef) {
        showError("Nenhuma tarefa em 'Para Aprovação' tem uma data de vencimento definida para gerar o link mensal.");
        return;
      }
      
      const { data: fnData, error: fnError } = await supabase.functions.invoke('generate-approval-link', {
        body: {
          clientId: clientId,
          monthYearRef: monthYearRef,
          userId: userId,
        },
      });
      
      if (error) throw fnError;
      
      const uniqueId = (fnData as any).uniqueId;
      const publicLink = `${window.location.origin}/approval/${uniqueId}`;
      
      const taskIdsToUpdate = tasksToReview.map(t => t.id);
      const { error: updateTasksError } = await supabase
        .from("client_tasks")
        .update({ public_approval_link_id: uniqueId })
        .in("id", taskIdsToUpdate);
        
      if (updateTasksError) console.error("Erro ao atualizar tarefas com link:", updateTasksError);
      
      return publicLink;
    },
    onSuccess: (publicLink) => {
      showSuccess("Link de aprovação gerado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId] });
      return publicLink;
    },
    onError: (err: any) => {
      showError("Erro ao gerar link: " + (err.message || "Função Edge retornou um erro."));
    },
  });

  return {
    // Data & State
    client: data?.client,
    tasksByStatus,
    isLoading,
    error,
    refetch,
    KANBAN_COLUMNS,
    
    // DND
    activeDragItem,
    handleDragStart,
    handleDragEnd,
    
    // Mutations & Actions
    handleGenerateApprovalLink,
    
    // UI State
    currentMonthYear,
    setCurrentMonthYear,
  };
};

export type ClientKanbanHook = ReturnType<typeof useClientKanban>;