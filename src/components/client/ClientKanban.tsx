"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, PlusCircle, Edit, Trash2, Repeat, CalendarDays, Link as LinkIcon, Send, Copy, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, getInitials } from '@/lib/utils';
import PageTitle from "@/components/layout/PageTitle";
import { useSession } from '@/integrations/supabase/auth';
import { showError, showSuccess, showInfo } from '@/utils/toast';
import { DndContext, closestCorners, DragEndEvent, useSensor, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import ClientTaskCard from './ClientTaskCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'; // Importação corrigida
import ClientTaskForm from './ClientTaskForm';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ClientTaskTemplates from './ClientTaskTemplates';
import copy from 'copy-to-clipboard';
import { Input } from '@/components/ui/input';

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
  { id: "in_progress", title: "Em Produção", color: "text-muted-foreground" },
  { id: "under_review", title: "Para Aprovação", color: "text-primary" },
  { id: "edit_requested", title: "Edição Solicitada", color: "text-primary" },
  { id: "approved", title: "Aprovado", color: "text-foreground" }, // Neutro
  { id: "posted", title: "Postado/Concluído", color: "text-muted-foreground" },
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
  const [initialStatus, setInitialStatus] = useState<ClientTaskStatus | undefined>(undefined);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null); // Estado para o Lightbox

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["clientTasks", clientId, userId],
    queryFn: () => fetchClientData(clientId!, userId!),
    enabled: !!clientId && !!userId,
    staleTime: 1000 * 60 * 1,
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
    // Garantir que as tarefas dentro de cada coluna estejam ordenadas pelo order_index
    map.forEach(tasks => tasks.sort((a, b) => a.order_index - b.order_index));
    return map;
  }, [data?.tasks]);
  
  const tasksUnderReview = tasksByStatus.get('under_review') || [];

  const handleTaskSaved = () => {
    refetch();
    setIsTaskFormOpen(false);
    setEditingTask(undefined);
    setOpenTaskId(null);
    setInitialStatus(undefined);
  };

  const handleEditTask = useCallback((task: ClientTask) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  }, []);
  
  const handleAddTaskInColumn = useCallback((status: ClientTaskStatus) => {
    setEditingTask(undefined);
    setInitialStatus(status);
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
      // Não usamos showSuccess aqui para evitar spam de toast durante o DND
      queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId] });
      queryClient.invalidateQueries({ queryKey: ["allTasks", userId] }); // Invalida tarefas principais
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
    
    if (!targetStatus) return;

    const targetTasks = tasksByStatus.get(targetStatus) || [];
    let newOrderIndex = targetTasks.length; // Default: move para o final da coluna

    if (over.data.current?.sortable?.index !== undefined) {
        // Se soltou sobre outro item, use o índice desse item
        newOrderIndex = over.data.current.sortable.index;
    }
    
    // Se o status mudou OU a ordem mudou dentro da mesma coluna
    if (sourceStatus !== targetStatus || draggedTask.order_index !== newOrderIndex) {
        // 1. Atualiza o status e a ordem da tarefa arrastada
        updateTaskStatusAndOrder.mutate({ 
            taskId: draggedTask.id, 
            newStatus: targetStatus, 
            newOrderIndex: newOrderIndex 
        });
        
        // 2. Reordena as outras tarefas na coluna de destino (e origem, se necessário)
        // Para simplificar, confiamos no refetch para reordenar o array completo.
        // O DND Kit lida com a reordenação visualmente, mas o DB precisa ser corrigido.
        // O `order_index` é atualizado na mutação, e o `refetch` garante a consistência.
    }
  };
  
  const handleGenerateApprovalLink = useMutation({
    mutationFn: async () => {
      if (!userId || !clientId) throw new Error("Usuário não autenticado ou cliente inválido.");
      
      const tasksToReview = tasksUnderReview.filter(t => t.public_approval_enabled);
      if (tasksToReview.length === 0) {
        showInfo("Nenhuma tarefa em 'Para Aprovação' com aprovação pública habilitada.");
        return;
      }
      
      // Usamos o mês de referência da primeira tarefa, assumindo que o link é mensal
      const monthYearRef = tasksToReview[0].month_year_reference;
      
      const { data: fnData, error: fnError } = await supabase.functions.invoke('generate-approval-link', {
        body: {
          clientId: clientId,
          monthYearRef: monthYearRef,
          userId: userId,
        },
      });

      if (fnError) throw fnError;
      
      const uniqueId = (fnData as any).uniqueId;
      const publicLink = `${window.location.origin}/approval/${uniqueId}`;
      
      // Atualiza todas as tarefas 'under_review' com o novo link_id
      const taskIdsToUpdate = tasksToReview.map(t => t.id);
      const { error: updateTasksError } = await supabase
        .from("client_tasks")
        .update({ public_approval_link_id: uniqueId })
        .in("id", taskIdsToUpdate);
        
      if (updateTasksError) console.error("Erro ao atualizar tarefas com link:", updateTasksError);
      
      setGeneratedLink(publicLink);
      setIsLinkModalOpen(true);
      refetch();
    },
    onSuccess: () => {
      showSuccess("Link de aprovação gerado com sucesso!");
    },
    onError: (err: any) => {
      showError("Erro ao gerar link: " + err.message);
    },
  });
  
  const handleCopyLink = (link: string) => {
    copy(link);
    showSuccess("Link copiado!");
  };
  
  const handleImageClick = (url: string) => {
    setLightboxUrl(url);
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
              <Button onClick={() => handleAddTaskInColumn('in_progress')} className="bg-primary text-primary-foreground hover:bg-primary/90">
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
                initialData={editingTask ? editingTask : { status: initialStatus }}
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
          {/* Botão de Link de Aprovação */}
          {tasksUnderReview.length > 0 && (
            <div className="mb-4">
              <Button 
                onClick={() => handleGenerateApprovalLink.mutate()} 
                disabled={handleGenerateApprovalLink.isPending}
                className="w-full bg-primary text-white hover:bg-primary/90"
              >
                {handleGenerateApprovalLink.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Gerar Link de Aprovação ({tasksUnderReview.filter(t => t.public_approval_enabled).length} itens)
              </Button>
            </div>
          )}
          
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
          >
            {/* Ajuste de altura para melhor responsividade: h-full min-h-[60vh] */}
            <div className="flex overflow-x-auto space-x-4 pb-4 custom-scrollbar h-full min-h-[60vh]">
              {KANBAN_COLUMNS.map(column => (
                <Card key={column.id} className="w-80 flex-shrink-0 bg-secondary/50 border-border shadow-lg flex flex-col">
                  <CardHeader className="p-3 pb-2 flex-shrink-0">
                    <CardTitle className={cn("text-lg font-semibold", column.color)}>{column.title} ({tasksByStatus.get(column.id)?.length || 0})</CardTitle>
                    <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleAddTaskInColumn(column.id)} 
                          className="w-full border-dashed border-border text-primary hover:bg-primary/10 h-8 text-sm mt-2"
                        >
                          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
                        </Button>
                      </DialogTrigger>
                    </Dialog>
                  </CardHeader>
                  
                  <ScrollArea className="flex-1 p-3 pt-0">
                    <CardContent className="space-y-3 min-h-[100px]">
                      <SortableContext 
                        items={tasksByStatus.get(column.id)?.map(t => t.id) || []} 
                        strategy={verticalListSortingStrategy}
                        id={column.id}
                      >
                        {tasksByStatus.get(column.id)?.map(task => (
                          <ClientTaskCard 
                            key={task.id} 
                            task={task} 
                            onEdit={handleEditTask} 
                            refetchTasks={refetch}
                            onImageClick={handleImageClick} // Passando a função de clique
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
            setInitialStatus(undefined);
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
            initialData={editingTask ? editingTask : { status: initialStatus }}
            onClientTaskSaved={handleTaskSaved}
            onClose={() => setIsTaskFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
      
      {/* Modal para exibir o link de aprovação gerado */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Link de Aprovação Gerado</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Compartilhe este link com o cliente para aprovação dos posts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={generatedLink || ''} readOnly className="bg-input border-border text-foreground focus-visible:ring-ring" />
            <Button onClick={() => handleCopyLink(generatedLink || '')} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              <Copy className="mr-2 h-4 w-4" /> Copiar Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Lightbox para Imagem */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="lightbox-fullscreen-override">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLightboxUrl(null)} 
            className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 h-10 w-10"
          >
            <XCircle className="h-6 w-6" />
          </Button>
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="Visualização em Tela Cheia"
              className="max-w-[95%] max-h-[95%] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientKanban;