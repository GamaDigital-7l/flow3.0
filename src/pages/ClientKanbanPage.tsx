"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Client, ClientTask, ClientTaskStatus } from "@/types/client";
import { useSession } from "@/integrations/supabase/auth";
import { DndContext, DragEndEvent, closestCorners, DragOverEvent } from "@dnd-kit/core";
import ClientKanbanColumn from "@/components/client/ClientKanbanColumn";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import ClientTaskForm from "@/components/client/ClientTaskForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { showError, showSuccess } from "@/utils/toast";
import ClientKanbanSkeleton from "@/components/client/ClientKanbanSkeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import EditReasonDialog from "@/components/client/EditReasonDialog"; // Corrected import path

const KANBAN_COLUMNS: { id: ClientTaskStatus; title: string }[] = [
  { id: "pending", title: "A Fazer" },
  { id: "in_progress", title: "Em Produção" },
  { id: "edit_requested", title: "Edição Solicitada" }, // Adicionado coluna de Edição Solicitada
  { id: "under_review", title: "Para Aprovação" },
  { id: "approved", title: "Aprovado" },
  { id: "posted", title: "Postado" },
];

const fetchClientTasks = async (clientId: string, userId: string): Promise<ClientTask[]> => {
  const { data, error } = await supabase
    .from("client_tasks")
    .select("*, tags:client_task_tags(tags(id, name, color))")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .order("order_index", { ascending: true });

  if (error) throw error;

  return data.map(task => ({
    ...task,
    tags: task.tags.map((t: any) => t.tags)
  }));
};

interface ClientKanbanPageProps {
  client: Client;
}

const ClientKanbanPage: React.FC<ClientKanbanPageProps> = ({ client }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ClientTask | undefined>(undefined);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isEditReasonDialogOpen, setIsEditReasonDialogOpen] = useState(false);
  const [taskToProcess, setTaskToProcess] = useState<ClientTask | null>(null);
  const [targetStatus, setTargetStatus] = useState<ClientTaskStatus | null>(null);
  const [localTasks, setLocalTasks] = useState<ClientTask[]>([]); // Estado local para DND

  const { data: fetchedTasks, isLoading, error, refetch } = useQuery<ClientTask[], Error>({
    queryKey: ["clientTasks", client.id, userId],
    queryFn: () => fetchClientTasks(client.id, userId!),
    enabled: !!userId,
  });

  // Sincronizar tarefas buscadas com o estado local
  React.useEffect(() => {
    if (fetchedTasks) {
      setLocalTasks(fetchedTasks);
    }
  }, [fetchedTasks]);

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus, reason, newOrderIndex }: { taskId: string; newStatus: ClientTaskStatus; reason?: string; newOrderIndex?: number }) => {
      const updatePayload: { status: ClientTaskStatus, edit_reason?: string | null, is_completed?: boolean, completed_at?: string | null, updated_at: string, order_index?: number } = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newOrderIndex !== undefined) {
        updatePayload.order_index = newOrderIndex;
      }

      if (newStatus === 'edit_requested') {
        updatePayload.edit_reason = reason || null;
        updatePayload.is_completed = false;
        updatePayload.completed_at = null;
      } else if (newStatus === 'approved' || newStatus === 'posted') {
        updatePayload.is_completed = true;
        updatePayload.completed_at = new Date().toISOString();
        updatePayload.edit_reason = null;
      } else {
        updatePayload.is_completed = false;
        updatePayload.completed_at = null;
        updatePayload.edit_reason = null;
      }

      const { error } = await supabase
        .from("client_tasks")
        .update(updatePayload)
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      if (variables.newOrderIndex === undefined) {
        const statusTitle = KANBAN_COLUMNS.find(c => c.id === variables.newStatus)?.title || variables.newStatus;
        showSuccess(`Tarefa movida para "${statusTitle}"!`);
      }
      // Refetch completo para garantir a ordem correta no DB e no cache
      queryClient.invalidateQueries({ queryKey: ["clientTasks", client.id, userId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks", "client_tasks", userId] }); // Invalidate dashboard mirror
      queryClient.invalidateQueries({ queryKey: ["clientProgress", client.id, userId] }); // Invalidate progress
    },
    onError: (err: any) => {
      showError("Erro ao mover tarefa: " + err.message);
      // Se houver erro, forçar o refetch para reverter o estado local
      refetch();
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const taskId = active.id as string;
    const task = localTasks.find(t => t.id === taskId);
    if (!task) return;

    const oldStatus = task.status;
    let newStatus: ClientTaskStatus;
    let newOrderIndex: number;

    const overIsAColumn = KANBAN_COLUMNS.some(col => col.id === over.id);

    if (overIsAColumn) {
      newStatus = over.id as ClientTaskStatus;
      // Se soltar na coluna vazia, vai para o final
      newOrderIndex = (tasksByColumn.get(newStatus)?.length || 0) + 1;
    } else {
      const overTask = localTasks.find(t => t.id === over.id);
      if (!overTask) return;
      newStatus = overTask.status;

      // Calcular a nova ordem
      const columnTasks = tasksByColumn.get(newStatus) || [];
      const overIndex = columnTasks.findIndex(t => t.id === overTask.id);
      const activeIndex = columnTasks.findIndex(t => t.id === taskId);

      if (oldStatus === newStatus) {
        // Reordenação dentro da mesma coluna
        if (activeIndex === overIndex) return;
        
        const newTasks = [...columnTasks];
        const [movedTask] = newTasks.splice(activeIndex, 1);
        newTasks.splice(overIndex, 0, movedTask);

        // Atualizar o estado local imediatamente para feedback visual
        setLocalTasks(prev => {
            const updatedTasks = prev.map(t => {
                if (t.id === taskId) return { ...t, order_index: newTasks[overIndex].order_index };
                return t;
            });
            // Reconstruir a lista completa com a nova ordem para a coluna afetada
            const updatedColumnTasks = updatedTasks.filter(t => t.status === newStatus).sort((a, b) => a.order_index - b.order_index);
            
            // Aplicar a nova ordem de índice (0, 1, 2...)
            const finalUpdatedTasks = updatedTasks.map(t => {
                const indexInNewColumn = newTasks.findIndex(nt => nt.id === t.id);
                if (t.status === newStatus && indexInNewColumn !== -1) {
                    return { ...t, order_index: indexInNewColumn };
                }
                return t;
            });
            return finalUpdatedTasks;
        });

        // Enviar a atualização de ordem para o DB (apenas o item movido)
        newOrderIndex = overIndex;
        updateTaskStatusMutation.mutate({ taskId, newStatus: oldStatus, newOrderIndex });
        return;
      } else {
        // Mudança de coluna
        newOrderIndex = overIndex;
      }
    }

    // Validação de transição de status
    if (newStatus === 'approved' || newStatus === 'posted') {
        if (oldStatus !== 'under_review' && oldStatus !== 'approved') {
            showError("Aprovação e Postagem só podem ser feitas a partir de 'Para Aprovação' ou 'Aprovado'.");
            // Reverter o estado local se a transição for inválida
            setLocalTasks(fetchedTasks || []);
            return;
        }
    }
    
    // Se a tarefa for movida para 'edit_requested', forçamos o diálogo de razão
    if (newStatus === 'edit_requested') {
        setTaskToProcess(task);
        setIsEditReasonDialogOpen(true);
        // Não atualiza o estado local ainda, espera a razão
        return;
    }

    // Atualizar o estado local para mudança de coluna
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, order_index: newOrderIndex } : t));

    // Enviar a atualização de status e ordem para o DB
    updateTaskStatusMutation.mutate({ taskId, newStatus, newOrderIndex });
  };

  const handleTaskSaved = () => {
    refetch();
    setIsFormOpen(false);
    setEditingTask(undefined);
  };

  const handleEditTask = (task: ClientTask) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleApproveClick = (taskId: string) => {
    const task = localTasks.find(t => t.id === taskId);
    if (task) {
      setTaskToProcess(task);
      const statusToSet = task.status === 'approved' ? 'posted' : 'approved';
      setTargetStatus(statusToSet);
      setIsApproveDialogOpen(true);
    }
  };

  const confirmApprove = () => {
    if (taskToProcess && targetStatus) {
      updateTaskStatusMutation.mutate({ taskId: taskToProcess.id, newStatus: targetStatus });
    }
    setIsApproveDialogOpen(false);
    setTaskToProcess(null);
    setTargetStatus(null);
  };

  const handleRequestEditClick = (task: ClientTask) => {
    setTaskToProcess(task);
    setIsEditReasonDialogOpen(true);
  };

  const handleEditReasonSubmit = (reason: string) => {
    if (taskToProcess) {
      // Atualiza o estado local e envia para o DB
      setLocalTasks(prev => prev.map(t => t.id === taskToProcess.id ? { ...t, status: "edit_requested", edit_reason: reason } : t));
      updateTaskStatusMutation.mutate({ taskId: taskToProcess.id, newStatus: "edit_requested", reason });
    }
    setIsEditReasonDialogOpen(false);
    setTaskToProcess(null);
  };

  const tasksByColumn = useMemo(() => {
    const columns = new Map<ClientTaskStatus, ClientTask[]>();
    KANBAN_COLUMNS.forEach(col => columns.set(col.id, []));
    
    // Usar localTasks para o render do DND
    localTasks.forEach(task => {
      const column = columns.get(task.status);
      if (column) {
        column.push(task);
      }
    });

    // Ordenar as tarefas dentro de cada coluna pelo order_index
    columns.forEach(tasks => {
      tasks.sort((a, b) => a.order_index - b.order_index);
    });

    return columns;
  }, [localTasks]);

  if (isLoading) return <ClientKanbanSkeleton />;
  if (error) return <p className="text-red-500">Erro ao carregar tarefas: {error.message}</p>;

  return (
    <div>
      <div className="mb-4">
        <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingTask(undefined); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTask(undefined)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle>{editingTask ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
            </DialogHeader>
            <ClientTaskForm
              clientId={client.id}
              initialData={editingTask as any}
              onClientTaskSaved={handleTaskSaved}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map(({ id, title }) => (
            <ClientKanbanColumn
              key={id}
              id={id}
              title={title}
              tasks={tasksByColumn.get(id) || []}
              onEditTask={handleEditTask}
              onApproveTask={handleApproveClick}
              onRequestEditTask={handleRequestEditClick}
            />
          ))}
        </div>
      </DndContext>

      <AlertDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar {targetStatus === 'posted' ? 'Postagem' : 'Aprovação'}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja {targetStatus === 'posted' ? 'marcar como postado' : 'aprovar'} a tarefa "{taskToProcess?.title}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApprove}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditReasonDialog
        isOpen={isEditReasonDialogOpen}
        onClose={() => setIsEditReasonDialogOpen(false)}
        onSubmit={handleEditReasonSubmit}
        initialReason={taskToProcess?.edit_reason}
      />
    </div>
  );
};

export default ClientKanbanPage;