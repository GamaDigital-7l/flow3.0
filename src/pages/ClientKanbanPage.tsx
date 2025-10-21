"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Client, ClientTask, ClientTaskStatus } from "@/types/client";
import { useSession } from "@/integrations/supabase/auth";
import { DndContext, DragEndEvent, closestCorners } from "@dnd-kit/core";
import ClientKanbanColumn from "@/components/client/ClientKanbanColumn";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import ClientTaskForm from "@/components/client/ClientTaskForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { showError, showSuccess } from "@/utils/toast";
import ClientKanbanSkeleton from "@/components/client/ClientKanbanSkeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import EditReasonDialog from "@/components/client/EditReasonDialog";

const KANBAN_COLUMNS: { id: ClientTaskStatus; title: string }[] = [
  { id: "pending", title: "A Fazer" },
  { id: "in_progress", title: "Em Produção" },
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

  const { data: tasks, isLoading, error, refetch } = useQuery<ClientTask[], Error>({
    queryKey: ["clientTasks", client.id, userId],
    queryFn: () => fetchClientTasks(client.id, userId!),
    enabled: !!userId,
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus, reason }: { taskId: string; newStatus: ClientTaskStatus; reason?: string }) => {
      const { error } = await supabase
        .from("client_tasks")
        .update({ status: newStatus, edit_reason: reason, updated_at: new Date().toISOString() })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const statusTitle = KANBAN_COLUMNS.find(c => c.id === variables.newStatus)?.title || variables.newStatus;
      showSuccess(`Tarefa movida para "${statusTitle}"!`);
      queryClient.invalidateQueries({ queryKey: ["clientTasks", client.id, userId] });
    },
    onError: (err: any) => {
      showError("Erro ao mover tarefa: " + err.message);
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const taskId = active.id as string;
    const task = tasks?.find(t => t.id === taskId);

    if (!task) return;

    // Determine the destination status
    let newStatus: ClientTaskStatus;
    const overIsAColumn = KANBAN_COLUMNS.some(col => col.id === over.id);

    if (overIsAColumn) {
      newStatus = over.id as ClientTaskStatus;
    } else {
      // Dropped on another task, find that task's status
      const overTask = tasks?.find(t => t.id === over.id);
      if (!overTask) return;
      newStatus = overTask.status;
    }

    // Only mutate if the status is actually changing
    if (task.status !== newStatus) {
      updateTaskStatusMutation.mutate({ taskId, newStatus });
    }
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
    const task = tasks?.find(t => t.id === taskId);
    if (task) {
      setTaskToProcess(task);
      setIsApproveDialogOpen(true);
    }
  };

  const confirmApprove = () => {
    if (taskToProcess) {
      updateTaskStatusMutation.mutate({ taskId: taskToProcess.id, newStatus: "approved" });
    }
    setIsApproveDialogOpen(false);
    setTaskToProcess(null);
  };

  const handleRequestEditClick = (task: ClientTask) => {
    setTaskToProcess(task);
    setIsEditReasonDialogOpen(true);
  };

  const handleEditReasonSubmit = (reason: string) => {
    if (taskToProcess) {
      updateTaskStatusMutation.mutate({ taskId: taskToProcess.id, newStatus: "edit_requested", reason });
    }
    setIsEditReasonDialogOpen(false);
    setTaskToProcess(null);
  };

  const tasksByColumn = useMemo(() => {
    const columns = new Map<ClientTaskStatus, ClientTask[]>();
    KANBAN_COLUMNS.forEach(col => columns.set(col.id, []));
    tasks?.forEach(task => {
      const column = columns.get(task.status);
      if (column) {
        column.push(task);
      }
    });
    return columns;
  }, [tasks]);

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
            <AlertDialogTitle>Confirmar Aprovação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja aprovar a tarefa "{taskToProcess?.title}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApprove}>Aprovar</AlertDialogAction>
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