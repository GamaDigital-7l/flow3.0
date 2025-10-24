"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Edit, Trash2, CalendarDays, Clock, CheckCircle2, Edit3, GripVertical, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { DndContext, closestCorners, DragEndEvent, useSensor, Sensor } from '@dnd-kit/core';
import { MouseSensor as InnerMouseSensor, TouchSensor as InnerTouchSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { arrayMove } from '@dnd-kit/sortable';
import { ScrollArea } from '@/components/ui/scroll-area';

// Tipos simplificados
type ClientTaskStatus = "in_progress" | "under_review" | "approved" | "edit_requested" | "posted";
interface ClientTask {
  id: string;
  title: string;
  description: string | null;
  status: ClientTaskStatus;
  due_date: string | null;
  time: string | null;
  image_urls: string[] | null;
  public_approval_enabled: boolean;
  edit_reason: string | null;
  order_index: number;
  client_id: string;
  user_id: string;
  is_completed: boolean;
  tags?: { id: string; name: string; color: string }[];
}
interface Client {
  id: string;
  name: string;
  logo_url: string | null;
}

const KANBAN_COLUMNS: { id: ClientTaskStatus; title: string; color: string }[] = [
  { id: "in_progress", title: "Em Produção", color: "text-blue-500" },
  { id: "under_review", title: "Para Aprovação", color: "text-yellow-500" },
  { id: "approved", title: "Aprovado", color: "text-green-500" },
  { id: "edit_requested", title: "Edição Solicitada", color: "text-orange-500" },
  { id: "posted", title: "Postado/Concluído", color: "text-purple-500" },
];

const fetchClientData = async (clientId: string, userId: string): Promise<{ client: Client | null, tasks: ClientTask[] }> => {
  const [clientResponse, tasksResponse] = await supabase
    .from("clients")
    .select("id, name, logo_url")
    .eq("id", clientId)
    .eq("user_id", userId)
    .single();

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

const ClientKanban: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ClientTask | undefined>(undefined);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["clientTasks", clientId, userId],
    queryFn: () => fetchClientData(clientId!, userId!),
    enabled: !!clientId && !!userId,
    staleTime: 1000 * 60 * 1,
  });

  const client = data?.client;
  const tasks = data?.tasks || [];

  const tasksByColumn = useMemo(() => {
    return KANBAN_COLUMNS.reduce((acc, column) => {
      acc[column.id] = tasks.filter(task => task.status === column.id);
      return acc;
    }, {} as Record<ClientTaskStatus, ClientTask[]>);
  }, [tasks]);

  const updateTaskStatusAndOrder = useMutation({
    mutationFn: async ({ taskId, newStatus, newOrderIndex }: { taskId: string, newStatus: ClientTaskStatus, newOrderIndex: number }) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      
      const isCompleted = newStatus === 'approved' || newStatus === 'posted';
      
      const { error } = await supabase
        .from("client_tasks")
        .update({ 
          status: newStatus, 
          order_index: newOrderIndex,
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("client_id", clientId)
        .eq("user_id", userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId] });
    },
    onError: (err: any) => {
      showError("Erro ao mover tarefa: " + err.message);
    },
  });

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const oldContainerId = active.data.current?.sortable.containerId as ClientTaskStatus;
    const newContainerId = over.data.current?.sortable.containerId as ClientTaskStatus;

    if (oldContainerId === newContainerId && activeId === overId) {
      return; // No change
    }

    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    const newStatus = newContainerId;

    // Determine the new order index
    const newIndex = tasksByColumn[newStatus].findIndex(t => t.id === overId);
    const finalIndex = newIndex === -1 ? tasksByColumn[newStatus].length : newIndex;

    // Optimistically update the UI
    queryClient.setQueryData(["clientTasks", clientId, userId], (oldData: any) => {
      if (!oldData) return oldData;

      const newTasks = oldData.tasks.map((t: ClientTask) => {
        if (t.id === activeId) {
          return { ...t, status: newStatus, order_index: finalIndex };
        }
        return t;
      });

      return { ...oldData, tasks: newTasks };
    });

    // Call the mutation to update the task
    updateTaskStatusAndOrder.mutate({ taskId: activeTask.id, newStatus: newStatus, newOrderIndex: finalIndex });
  }, [tasks, tasksByColumn, updateTaskStatusAndOrder, clientId, userId, queryClient]);

  const handleTaskSaved = () => {
    refetch();
    setIsTaskFormOpen(false);
    setEditingTask(undefined);
  };

  const handleEditTask = (task: ClientTask) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  // Custom sensors for better mobile experience
  const mouseSensor = useSensor(InnerMouseSensor, { activationConstraint: { distance: 10 } });
  const touchSensor = useSensor(InnerTouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } });
  const sensors: Sensor[] = [mouseSensor, touchSensor];

  return (
    <div className="page-content-wrapper space-y-6">
      <PageTitle title={`Workspace: ${client.name}`} description="Gerencie o fluxo de trabalho e aprovações do cliente.">
        <Button variant="outline" onClick={() => navigate('/clients')}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes</Button>
      </PageTitle>

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <div className="flex overflow-x-auto space-x-4 pb-4 custom-scrollbar h-[calc(100vh-180px)]">
          {KANBAN_COLUMNS.map(column => (
            <Card key={column.id} className="w-80 flex-shrink-0 bg-secondary/50 border-border shadow-lg flex flex-col">
              <CardHeader className="p-3 pb-2 flex-shrink-0">
                <CardTitle className={cn("text-lg font-semibold flex items-center justify-between", column.color)}>
                  {column.title} ({tasksByColumn[column.id].length})
                  <Dialog open={isTaskFormOpen && editingTask?.status === column.id} onOpenChange={setIsTaskFormOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => { setEditingTask(undefined); setIsTaskFormOpen(true); }}
                        className="h-8 w-8 text-primary hover:bg-primary/10"
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
                      <DialogHeader>
                        <DialogTitle className="text-foreground">Adicionar Nova Tarefa</DialogTitle>
                        <DialogDescription>Crie um novo post ou tarefa para o cliente.</DialogDescription>
                      </DialogHeader>
                      <ClientTaskForm
                        clientId={clientId!}
                        initialData={{ status: column.id }}
                        onClientTaskSaved={handleTaskSaved}
                        onClose={() => setIsTaskFormOpen(false)}
                      />
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              
              <ScrollArea className="flex-1 p-3 pt-0">
                <SortableContext items={tasksByColumn[column.id].map(t => t.id)} strategy={verticalListSortingStrategy} id={column.id}>
                  <div className="space-y-3">
                    {tasksByColumn[column.id].map(task => (
                      <ClientTaskCard 
                        key={task.id} 
                        task={task} 
                        onEdit={handleEditTask} 
                        refetchTasks={refetch}
                      />
                    ))}
                  </div>
                </SortableContext>
              </ScrollArea>
            </Card>
          ))}
        </div>
      </DndContext>
      
      {/* Dialog para Edição/Criação de Tarefa */}
      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}</DialogTitle>
            <DialogDescription>
              {editingTask ? "Atualize os detalhes da tarefa." : "Crie um novo post ou tarefa para o cliente."}
            </DialogDescription>
          </DialogHeader>
          <ClientTaskForm
            clientId={clientId!}
            initialData={editingTask}
            onClientTaskSaved={handleTaskSaved}
            onClose={() => setIsTaskFormOpen(false)}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};