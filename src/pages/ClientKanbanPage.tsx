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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  { id: "edit_requested", title: "Ajustes Solicitados" },
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
  const [editingTask, setEditingTask] = useState<ClientTask | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isEditReasonDialogOpen, setIsEditReasonDialogOpen] = useState(false);
  const [taskToProcess, setTaskToProcess] = useState<ClientTask | null>(null);
  const [targetStatus, setTargetStatus] = useState<ClientTaskStatus | null>(null);

  const { data: tasks, isLoading, error } = useQuery<ClientTask[], Error>({
    queryKey: ["clientTasks", client.id, userId],
    queryFn: () => fetchClientTasks(client.id, userId!),
    enabled: !!userId,
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatus, reason }: { taskId: string; newStatus: ClientTaskStatus; reason?: string }) => {
      const payload: Partial<ClientTask> = { status: newStatus };
      if (newStatus === 'edit_requested') payload.edit_reason = reason;
      const { error } = await supabase.from("client_tasks").update(payload).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(`Tarefa movida com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["clientTasks", client.id, userId] });
    },
    onError: (err: any) => showError("Erro ao mover tarefa: " + err.message),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const task = active.data.current?.task as ClientTask;
    const newStatus = over.id as ClientTaskStatus;

    if (task && task.status !== newStatus) {
      updateTaskStatusMutation.mutate({ taskId: task.id, newStatus });
    }
  };

  const handleTaskSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["clientTasks", client.id, userId] });
    setIsFormOpen(false);
    setEditingTask(null);
  };

  const handleEditTask = (task: ClientTask) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleApproveClick = (taskId: string) => {
    const task = tasks?.find(t => t.id === taskId);
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
  };

  const tasksByColumn = useMemo(() => {
    const columns = new Map<ClientTaskStatus, ClientTask[]>();
    KANBAN_COLUMNS.forEach(col => columns.set(col.id, []));
    tasks?.forEach(task => {
      const column = columns.get(task.status);
      if (column) column.push(task);
    });
    return columns;
  }, [tasks]);

  if (isLoading) return <ClientKanbanSkeleton />;
  if (error) return <p className="text-destructive">Erro: {error.message}</p>;

  return (
    <>
      <div className="mb-4">
        <Button onClick={() => { setEditingTask(null); setIsFormOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
        </Button>
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

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle>{editingTask ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
          </DialogHeader>
          <ClientTaskForm
            clientId={client.id}
            initialData={editingTask || undefined}
            onClientTaskSaved={handleTaskSaved}
            onClose={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Ação</AlertDialogTitle>
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
      />
    </>
  );
};

export default ClientKanbanPage;