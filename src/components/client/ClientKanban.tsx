"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, PlusCircle, Edit, Trash2, Repeat, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, getInitials } from '@/lib/utils';
import PageTitle from "@/components/layout/PageTitle";
import { useSession } from '@/integrations/supabase/auth';
import { showError, showSuccess } from '@/utils/toast';
import { DndContext, closestCorners, DragEndEvent, useSensor, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import ClientTaskCard from './ClientTaskCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import ClientTaskForm from './ClientTaskForm';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ClientTaskTemplates from './ClientTaskTemplates'; // Importando o novo componente

// Define custom hooks locally to ensure compatibility
const useMouseSensor = (options: any = {}) => useSensor(MouseSensor, options);
const useTouchSensor = (options: any = {}) => useSensor(TouchSensor, options);

// Tipos completos
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
  client_id: string;
  user_id: string;
  is_completed: boolean;
  order_index: number;
  public_approval_link_id: string | null;
  tags: { id: string; name: string; color: string }[];
}
interface Client {
  id: string;
  name: string;
  logo_url: string | null;
}

const KANBAN_COLUMNS: { id: ClientTaskStatus; title: string; color: string }[] = [
  { id: "in_progress", title: "Em Produção", color: "text-blue-500" },
  { id: "under_review", title: "Para Aprovação", color: "text-yellow-500" },
  { id: "edit_requested", title: "Edição Solicitada", color: "text-orange-500" },
  { id: "approved", title: "Aprovado", color: "text-green-500" },
  { id: "posted", title: "Postado/Concluído", color: "text-purple-500" },
];

const fetchClientData = async (clientId: string, userId: string): Promise<{ client: Client | null, tasks: ClientTask[] }> => {
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
        id, title, description, status, due_date, time, image_urls, public_approval_enabled, edit_reason, client_id, user_id, is_completed, order_index, public_approval_link_id,
        client_task_tags(
          tags(id, name, color)
        )
      `)
      .eq("client_id", clientId)
      .eq("user_id", userId)
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
    tasks: mappedTasks,
  };
};

const ClientKanban: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ClientTask | undefined>(undefined);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'kanban' | 'templates'>('kanban');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["clientTasks", clientId, userId],
    queryFn: () => fetchClientData(clientId!, userId!),
    enabled: !!clientId && !!userId,
    staleTime: 1000 * 60 * 1, // 1 minute cache
  });
  
  // DND Sensors
  const mouseSensor = useMouseSensor();
  const touchSensor = useTouchSensor();
  const sensors = useMemo(() => [mouseSensor, touchSensor], [mouseSensor, touchSensor]);

  const tasksByStatus = useMemo(() => {
    const map = new Map<ClientTaskStatus, ClientTask[]>();
    KANBAN_COLUMNS.forEach(col => map.set(col.id, []));
    data?.tasks.forEach(task => {
      map.get(task.status)?.push(task);
    });
    return map;
  }, [data?.tasks]);

  const handleTaskSaved = () => {
    refetch();
    setIsTaskFormOpen(false);
    setEditingTask(undefined);
    setOpenTaskId(null);
  };

  const handleEditTask = useCallback((task: ClientTask) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  }, []);
  
  // Efeito para abrir o formulário de edição se um taskId for passado na URL
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const taskIdFromUrl = params.get('openTaskId');
    
    if (taskIdFromUrl && data?.tasks && !openTaskId) {
      const taskToEdit = data.tasks.find(t => t.id === taskIdFromUrl);
      if (taskToEdit) {
        setOpenTaskId(taskIdFromUrl);
        handleEditTask(taskToEdit);
      }
    }
  }, [location.search, data?.tasks, openTaskId, handleEditTask]);

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedTask = data?.tasks.find(t => t.id === active.id);
    if (!draggedTask) return;

    const sourceStatus = draggedTask.status;
    const targetStatus = over.data.current?.sortable?.containerId as ClientTaskStatus;
    
    // Se o destino for um card, precisamos calcular a nova ordem
    let newOrderIndex = draggedTask.order_index;
    
    if (over.data.current?.sortable?.index !== undefined) {
        // Se soltou sobre outro item, use o índice desse item
        newOrderIndex = over.data.current.sortable.index;
    } else if (targetStatus) {
        // Se soltou sobre a coluna vazia, use o último índice da coluna
        const targetTasks = tasksByStatus.get(targetStatus) || [];
        newOrderIndex = targetTasks.length;
    } else {
        return; // Não soltou em um local válido
    }

    // Se o status mudou, ou se a ordem mudou dentro da mesma coluna
    if (sourceStatus !== targetStatus || draggedTask.order_index !== newOrderIndex) {
        // 1. Atualiza o status e a ordem da tarefa arrastada
        updateTaskStatusAndOrder.mutate({ 
            taskId: draggedTask.id, 
            newStatus: targetStatus, 
            newOrderIndex: newOrderIndex 
        });
        
        // 2. Reordena as outras tarefas na coluna de destino (e origem, se necessário)
        // Esta lógica é complexa para fazer no cliente e sincronizar, então vamos confiar no refetch
        // e na ordenação do DB. Por enquanto, apenas invalidamos a query.
        queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId] });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.client) {
    showError("Erro ao carregar dados do cliente: " + (error?.message || "Cliente não encontrado."));
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold text-red-500">Erro ao carregar cliente.</h1>
        <Button onClick={() => navigate('/clients')} className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes</Button>
      </div>
    );
  }

  const { client } = data;

  return (
    <div className="page-content-wrapper space-y-6">
      <PageTitle title={`Workspace: ${client.name}`} description="Gerencie o fluxo de trabalho e aprovações do cliente.">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={client.logo_url || undefined} alt={client.name} />
            <AvatarFallback className="text-xs bg-primary/20 text-primary">{getInitials(client.name)}</AvatarFallback>
          </Avatar>
          <Button variant="outline" onClick={() => navigate('/clients')}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
          <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingTask(undefined)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Nova Tarefa
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">{editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}</DialogTitle>
                <DialogDescription>
                  {editingTask ? "Atualize os detalhes da tarefa." : "Crie uma nova tarefa para o cliente."}
                </DialogDescription>
              </DialogHeader>
              <ClientTaskForm
                clientId={clientId!}
                initialData={editingTask}
                onClientTaskSaved={handleTaskSaved}
                onClose={() => setIsTaskFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </PageTitle>
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'kanban' | 'templates')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted text-muted-foreground">
          <TabsTrigger value="kanban"><CalendarDays className="mr-2 h-4 w-4" /> Kanban</TabsTrigger>
          <TabsTrigger value="templates"><Repeat className="mr-2 h-4 w-4" /> Templates</TabsTrigger>
        </TabsList>
        
        <TabsContent value="kanban" className="mt-4">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
          >
            <div className="flex overflow-x-auto space-x-4 pb-4 custom-scrollbar h-[calc(100vh-15rem)]">
              {KANBAN_COLUMNS.map(column => (
                <Card key={column.id} className="w-80 flex-shrink-0 bg-secondary/50 border-border shadow-lg flex flex-col">
                  <CardHeader className="p-3 pb-2 flex-shrink-0">
                    <CardTitle className={cn("text-lg font-semibold", column.color)}>{column.title} ({tasksByStatus.get(column.id)?.length || 0})</CardTitle>
                  </CardHeader>
                  
                  <ScrollArea className="flex-1 p-3 pt-0">
                    <CardContent className="space-y-3 min-h-[100px]">
                      <SortableContext 
                        items={tasksByStatus.get(column.id)?.map(t => t.id) || []} 
                        strategy={verticalListSortingStrategy}
                        id={column.id} // Usar o ID da coluna como containerId
                      >
                        {tasksByStatus.get(column.id)?.map(task => (
                          <ClientTaskCard 
                            key={task.id} 
                            task={task} 
                            onEdit={handleEditTask} 
                            refetchTasks={refetch}
                          />
                        ))}
                      </SortableContext>
                      
                      {tasksByStatus.get(column.id)?.length === 0 && (
                        <p className="text-muted-foreground text-sm text-center p-4">Arraste tarefas para cá ou crie uma nova.</p>
                      )}
                    </CardContent>
                  </ScrollArea>
                </Card>
              ))}
            </div>
          </DndContext>
        </TabsContent>
        
        <TabsContent value="templates" className="mt-4">
          <ClientTaskTemplates clientId={clientId!} clientName={client.name} />
        </TabsContent>
      </Tabs>

      {/* Dialog para edição de Tarefa (Abre quando editingTask é definido) */}
      <Dialog 
        open={isTaskFormOpen} 
        onOpenChange={(open) => {
          setIsTaskFormOpen(open);
          if (!open) {
            setEditingTask(undefined);
            setOpenTaskId(null);
            // Limpa o parâmetro da URL se estiver presente
            if (location.search.includes('openTaskId')) {
              navigate(location.pathname, { replace: true });
            }
          }
        }}
      >
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}</DialogTitle>
            <DialogDescription>
              {editingTask ? "Atualize os detalhes da tarefa." : "Crie uma nova tarefa para o cliente."}
            </DialogDescription>
          </DialogHeader>
          <ClientTaskForm
            clientId={clientId!}
            initialData={editingTask}
            onClientTaskSaved={handleTaskSaved}
            onClose={() => setIsTaskFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientKanban;