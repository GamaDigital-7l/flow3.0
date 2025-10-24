"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, PlusCircle, Edit, Trash2, Repeat, CalendarDays, Link as LinkIcon, Send, Copy, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, getInitials } from '@/lib/utils';
import PageTitle from "@/components/layout/PageTitle";
import { useSession } from "@/integrations/supabase/auth";
import { showError, showSuccess, showInfo } from "@/utils/toast";
import { DndContext, closestCorners, DragEndEvent, useSensor, MouseSensor, TouchSensor, DragOverlay, useDndMonitor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import ClientTaskCard from './ClientTaskCard';
import KanbanColumn from './ClientKanbanColumn'; // Importando o novo componente de coluna
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import ClientTaskForm from './ClientTaskForm';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClientTaskTemplates from './ClientTaskTemplates';
import copy from 'copy-to-clipboard';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog"
import { PublicApprovalPage } from "@/pages";

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
  month_year_reference: string | null;
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
  { id: "approved", title: "Aprovado", color: "text-foreground" },
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
        id, title, description, status, due_date, time, image_urls, public_approval_enabled, edit_reason, client_id, user_id, is_completed, order_index, public_approval_link_id, month_year_reference,
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  
  // DND State
  const [activeDragItem, setActiveDragItem] = useState<ClientTask | null>(null);
  const [localTasks, setLocalTasks] = useState<ClientTask[]>([]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["clientTasks", clientId, userId],
    queryFn: () => fetchClientData(clientId!, userId!),
    enabled: !!clientId && !!userId,
    staleTime: 1000 * 60 * 1,
  });
  
  // Sincronizar tarefas do servidor para o estado local
  React.useEffect(() => {
    if (data?.tasks) {
      setLocalTasks(data.tasks);
    }
  }, [data?.tasks]);

  // DND Sensors
  const mouseSensor = useMouseSensor({ activationConstraint: { distance: 10 } });
  const touchSensor = useTouchSensor({ activationConstraint: { delay: 250, tolerance: 5 } });
  const sensors = useMemo(() => [mouseSensor, touchSensor], [mouseSensor, touchSensor]);

  const tasksByStatus = useMemo(() => {
    const map = new Map<ClientTaskStatus, ClientTask[]>();
    KANBAN_COLUMNS.forEach(col => map.set(col.id, []));
    localTasks.forEach(task => {
      map.get(task.status)?.push(task);
    });
    map.forEach(tasks => tasks.sort((a, b) => a.order_index - b.order_index));
    return map;
  }, [localTasks]);
  
  const tasksUnderReview = tasksByStatus.get('under_review') || [];

  const handleTaskSaved = () => {
    // Força o refetch do servidor para garantir a consistência
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
    mutationFn: async (updates: { taskId: string, newStatus: ClientTaskStatus, newOrderIndex: number }[]) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      
      const dbUpdates = updates.map(({ taskId, newStatus, newOrderIndex }) => {
        const isCompleted = newStatus === 'approved' || newStatus === 'posted';
        return {
          id: taskId,
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
      // Após a atualização do DB, forçamos o refetch para garantir a consistência
      queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId] });
      queryClient.invalidateQueries({ queryKey: ["allTasks", userId] });
    },
    onError: (err: any) => {
      showError("Erro ao mover tarefa: " + err.message);
      // Em caso de erro, reverte para o estado do servidor
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
    if (!over || active.id === over.id) return;

    const draggedTask = localTasks.find(t => t.id === active.id);
    if (!draggedTask) return;

    const sourceStatus = draggedTask.status;
    const targetStatus = over.data.current?.sortable?.containerId as ClientTaskStatus;
    
    if (!targetStatus) return;

    const sourceTasks = tasksByStatus.get(sourceStatus) || [];
    const targetTasks = tasksByStatus.get(targetStatus) || [];
    
    const activeIndex = sourceTasks.findIndex(t => t.id === active.id);
    const overIndex = over.data.current?.sortable?.index !== undefined 
        ? over.data.current.sortable.index 
        : targetTasks.length;

    // 1. Otimização: Atualiza o estado localmente para feedback instantâneo
    setLocalTasks(prevTasks => {
      const newTasks = prevTasks.map(t => ({ ...t })); // Clonar para mutação segura
      
      // Remove o item da lista de origem
      const taskToRemove = newTasks.findIndex(t => t.id === draggedTask.id);
      if (taskToRemove !== -1) {
        newTasks.splice(taskToRemove, 1);
      }
      
      // Encontra a posição correta na lista de destino
      const tasksInTargetStatus = newTasks.filter(t => t.status === targetStatus);
      
      // Insere o item na nova posição
      const newTask = { ...draggedTask, status: targetStatus };
      
      // Se o status mudou, insere no final. Se não, usa a lógica de arrayMove
      if (sourceStatus !== targetStatus) {
        // Se mudou de coluna, insere no índice calculado (overIndex)
        tasksInTargetStatus.splice(overIndex, 0, newTask);
      } else {
        // Se a coluna é a mesma, usamos arrayMove para reordenar
        const oldIndex = tasksInTargetStatus.findIndex(t => t.id === draggedTask.id);
        if (oldIndex !== -1) {
            tasksInTargetStatus.splice(oldIndex, 1); // Remove da posição antiga
        }
        tasksInTargetStatus.splice(overIndex, 0, newTask); // Insere na nova posição
      }
      
      // Reconstroi o array final e recalcula os order_index
      const finalTasks = [];
      const updatesToSend: { taskId: string, newStatus: ClientTaskStatus, newOrderIndex: number }[] = [];
      
      KANBAN_COLUMNS.forEach(col => {
        const tasksInCol = newTasks.filter(t => t.status === col.id);
        
        // Se a coluna é a de destino, usamos a lista atualizada
        const currentList = col.id === targetStatus ? tasksInTargetStatus : tasksInCol;
        
        currentList.forEach((task, index) => {
          task.order_index = index;
          task.status = col.id; // Garante que o status local está correto
          finalTasks.push(task);
          
          // Coleta as atualizações para enviar ao DB
          updatesToSend.push({
            taskId: task.id,
            newStatus: col.id,
            newOrderIndex: index,
          });
        });
      });
      
      // 2. Envia a atualização para o DB (batch update)
      updateTaskStatusAndOrder.mutate(updatesToSend);
      
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
      showError("Erro ao gerar link: " + (err.message || "Função Edge retornou um erro."));
    },
  });
  
  const handleCopyLink = (link: string) => {
    copy(link);
    showSuccess("Link copiado!");
  };
  
  const handleImageClick = (url: string) => {
    // Implementar a lógica para exibir a imagem em tela cheia
  };

  return (
    <div className="flex flex-col h-full">
      <PageTitle title={`Workspace: ${data?.client?.name}`} description="Gerencie o fluxo de trabalho e aprovações do cliente.">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={data?.client?.logo_url || undefined} alt={data?.client?.name} />
            <AvatarFallback className="text-xs bg-primary/20 text-primary">{getInitials(data?.client?.name || 'Cliente')}</AvatarFallback>
          </Avatar>
          <Button variant="outline" onClick={() => navigate('/clients')}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
        </div>
      </PageTitle>
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'kanban' | 'templates')} className="w-full flex-grow flex flex-col">
        <TabsList className="grid w-full grid-cols-2 bg-muted text-muted-foreground flex-shrink-0">
          <TabsTrigger value="kanban"><CalendarDays className="mr-2 h-4 w-4" /> Kanban</TabsTrigger>
          <TabsTrigger value="templates"><Repeat className="mr-2 h-4 w-4" /> Templates</TabsTrigger>
        </TabsList>
        
        <TabsContent value="kanban" className="mt-4 flex-grow flex flex-col min-h-0">
          {/* Botão de Link de Aprovação */}
          {tasksUnderReview.length > 0 && (
            <div className="mb-4 flex-shrink-0">
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
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Container principal do Kanban: flex-col no mobile, flex-row e overflow-x-auto no desktop */}
            <div className="flex flex-col sm:flex-row sm:overflow-x-auto sm:space-x-4 pb-4 custom-scrollbar w-full flex-grow min-h-[50vh] space-y-4 sm:space-y-0">
              {KANBAN_COLUMNS.map(column => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={tasksByStatus.get(column.id) || []}
                  onAddTask={handleAddTaskInColumn}
                  onEditTask={handleEditTask}
                  refetchTasks={refetch}
                  onImageClick={handleImageClick}
                />
              ))}
            </div>
            
            {/* Drag Overlay para feedback visual suave */}
            <DragOverlay>
              {activeDragItem ? (
                <ClientTaskCard 
                  task={activeDragItem} 
                  onEdit={handleEditTask} 
                  refetchTasks={refetch}
                  onImageClick={handleImageClick}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </TabsContent>
        
        <TabsContent value="templates" className="mt-4">
          <ClientTaskTemplates clientId={clientId!} clientName={data?.client?.name!} />
        </TabsContent>
      </Tabs>

      {/* Modal para exibir o link */}
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
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => handleCopyLink(generatedLink || '')} className="w-1/2 mr-2">
                <Copy className="mr-2 h-4 w-4" /> Copiar Link
              </Button>
              <Button onClick={() => {}} className="w-1/2 bg-green-500 text-white hover:bg-green-700">
                <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientKanban;
</dyad-file>

<dyad-write path="src/components/ui/dialog.tsx" description="Adding a custom class to the dialog content to allow for fullscreen lightbox.">
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-100 data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%]",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] max-h-[85vh] w-[90vw] max-w-[520px] translate-x-[-50%] translate-y-[-50%] top-[50%] z-50 grid w-full gap-4 border bg-card p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-100 data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%] md:max-w-[520px]",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary data-[state=open]:text-muted-foreground">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Header>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Footer>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-foreground",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogOverlay,
  DialogPortal,
}