"use client";

import React, { useState, useEffect } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Client, ClientTask, ClientTaskStatus } from '@/types/client';
import ClientKanbanColumn from '@/components/client/ClientKanbanColumn';
import { showError, showSuccess } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ClientTaskForm from '@/components/client/ClientTaskForm';
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { Loader2 } from 'lucide-react';

interface ClientKanbanPageProps {
  client: Client;
}

const KANBAN_COLUMNS: { id: ClientTaskStatus; title: string }[] = [
  { id: 'pending', title: 'A Fazer' },
  { id: 'in_progress', title: 'Em Progresso' },
  { id: 'under_review', title: 'Em Revisão' },
  { id: 'edit_requested', title: 'Ajustes Solicitados' },
  { id: 'approved', title: 'Aprovado' },
  { id: 'posted', title: 'Postado' },
];

const ClientKanbanPage: React.FC<ClientKanbanPageProps> = ({ client }) => {
  const queryClient = useQueryClient();
  const [tasksByStatus, setTasksByStatus] = useState<Record<ClientTaskStatus, ClientTask[]>>({
    pending: [], in_progress: [], under_review: [], approved: [], rejected: [], completed: [], edit_requested: [], posted: []
  });
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ClientTask | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<ClientTaskStatus>('pending');

  const { data: tasks, isLoading } = useQuery<ClientTask[]>({
    queryKey: ['client_tasks', client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_tasks')
        .select('*')
        .eq('client_id', client.id)
        .order('order_index', { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  useEffect(() => {
    if (tasks) {
      const groupedTasks = KANBAN_COLUMNS.reduce((acc, column) => {
        acc[column.id] = tasks.filter(task => task.status === column.id);
        return acc;
      }, {} as Record<ClientTaskStatus, ClientTask[]>);
      setTasksByStatus(groupedTasks);
    }
  }, [tasks]);

  const updateTaskMutation = useMutation({
    mutationFn: async (updatedTask: Partial<ClientTask> & { id: string }) => {
      const { error } = await supabase
        .from('client_tasks')
        .update(updatedTask)
        .eq('id', updatedTask.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_tasks', client.id] });
    },
    onError: (err) => {
      showError('Erro ao atualizar tarefa: ' + err.message);
    },
  });

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const sourceStatus = source.droppableId as ClientTaskStatus;
    const destStatus = destination.droppableId as ClientTaskStatus;

    const sourceTasks = Array.from(tasksByStatus[sourceStatus]);
    const [movedTask] = sourceTasks.splice(source.index, 1);

    if (sourceStatus === destStatus) {
      sourceTasks.splice(destination.index, 0, movedTask);
      setTasksByStatus(prev => ({ ...prev, [sourceStatus]: sourceTasks }));
      sourceTasks.forEach((task, index) => {
        updateTaskMutation.mutate({ id: task.id, order_index: index });
      });
    } else {
      const destTasks = Array.from(tasksByStatus[destStatus]);
      destTasks.splice(destination.index, 0, { ...movedTask, status: destStatus });
      setTasksByStatus(prev => ({
        ...prev,
        [sourceStatus]: sourceTasks,
        [destStatus]: destTasks,
      }));
      updateTaskMutation.mutate({ id: draggableId, status: destStatus, order_index: destination.index });
      sourceTasks.forEach((task, index) => {
        updateTaskMutation.mutate({ id: task.id, order_index: index });
      });
      destTasks.forEach((task, index) => {
        updateTaskMutation.mutate({ id: task.id, order_index: index });
      });
    }
  };

  const handleOpenTaskForm = (task: ClientTask | null, status: ClientTaskStatus) => {
    setSelectedTask(task);
    setSelectedColumn(status);
    setIsTaskFormOpen(true);
  };

  const handleCloseTaskForm = () => {
    setIsTaskFormOpen(false);
    setSelectedTask(null);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex overflow-x-auto space-x-4 p-1 pb-4">
          {KANBAN_COLUMNS.map(column => (
            <ClientKanbanColumn
              key={column.id}
              status={column.id}
              title={column.title}
              tasks={tasksByStatus[column.id] || []}
              onAddTask={() => handleOpenTaskForm(null, column.id)}
              onTaskClick={(task) => handleOpenTaskForm(task, column.id)}
            />
          ))}
        </div>
      </DragDropContext>

      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle>{selectedTask ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          </DialogHeader>
          <ClientTaskForm
            clientId={client.id}
            columnStatus={selectedColumn}
            task={selectedTask}
            onTaskSaved={() => queryClient.invalidateQueries({ queryKey: ['client_tasks', client.id] })}
            onClose={handleCloseTaskForm}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClientKanbanPage;