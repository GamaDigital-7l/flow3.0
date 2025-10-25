"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, PlusCircle, Edit, Trash2, Repeat, CalendarDays, Link as LinkIcon, Send, Copy, XCircle, MessageSquare, Eye, X, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, getInitials } from '@/lib/utils';
import PageTitle from "@/components/layout/PageTitle";
import { useSession } from "@/integrations/supabase/auth";
import { showError, showSuccess, showInfo } from '@/utils/toast';
import { DndContext, closestCorners, DragEndEvent, useSensor, MouseSensor, TouchSensor, DragOverlay, UniqueIdentifier } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import ClientTaskCard from './ClientTaskCard';
import KanbanColumn from './ClientKanbanColumn';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ClientTaskForm from './ClientTaskForm';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClientTaskTemplates from './ClientTaskTemplates';
import ClientVault from './ClientVault'; // Importar o novo componente
import copy from 'copy-to-clipboard';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog"
import ClientMonthSelector from './ClientMonthSelector';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

// Define custom hooks locally to ensure compatibility
const useMouseSensor = (options: any = {}) => useSensor(MouseSensor, options);
const useTouchSensor = (options: any = {}) => useSensor(TouchSensor, TouchSensor);
const sensors = useMemo(() => [mouseSensor, touchSensor], [mouseSensor, touchSensor]);

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
  { id: "under_review", title: "Para Aprovação", color="text-primary" },
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
      .eq("month_year_reference", monthYearRef) // Filtro por mês
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

type TabValue = "kanban" | "templates" | "vault"; // Adicionado 'vault'

const ClientKanban: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  
  // Estado para o mês/ano ativo (YYYY-MM)
  const [currentMonthYear, setCurrentMonthYear] = useState(format(new Date(), 'yyyy-MM'));

  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ClientTask | undefined>(undefined);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [initialStatus, setInitialStatus] = useState<ClientTaskStatus | undefined>(undefined);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>("kanban");
  
  // DND State
  const [activeDragItem, setActiveDragItem] = useState<ClientTask | null>(null);
  const [localTasks, setLocalTasks] = useState<ClientTask[]>([]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["clientTasks", clientId, userId, currentMonthYear],
    queryFn: () => fetchClientData(clientId!, userId!, currentMonthYear),
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
  const mouseSensor = useMouseSensor({ activationConstraint: { distance: 5 } });
  const touchSensor = useTouchSensor({ activationConstraint: { delay: 100, tolerance: 5 } });
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
      if (!userId || !clientId) throw new Error("Usuário não autenticado ou cliente inválido.");
      
      // 1. Buscar os dados completos das tarefas que serão atualizadas
      const taskIds = updates.map(u => u.taskId);
      const { data: existingTasks, error: fetchError } = await supabase
        .from("client_tasks")
        .select("id, title, month_year_reference, due_date, time, description, image_urls, public_approval_enabled, edit_reason, responsible_id")
        .in("id", taskIds);

      if (fetchError) throw fetchError;
      
      const taskMap = new Map(existingTasks.map(t => [t.id, t.id]));

      // 2. Montar o payload de upsert com todos os campos obrigatórios
      const dbUpdates = updates.map(({ taskId, newStatus, newOrderIndex }) => {
        const existing = taskMap.get(taskId);
        if (!existing) throw new Error(`Task ${taskId} not found for update.`);

        const isCompleted = newStatus === 'approved' || newStatus === 'posted';
        
        return {
          id: taskId,
          user_id: userId,
          client_id: clientId,
          title: existing.title, // Incluído - Garante que o título nunca seja nulo
          month_year_reference: existing.month_year_reference, // Incluído
          description: existing.description,
          due_date: existing.due_date,
          time: existing.time,
          image_urls: existing.image_urls,
          public_approval_enabled: existing.public_approval_enabled,
          edit_reason: existing.edit_reason,
          responsible_id: existing.responsible_id,
          
          // Campos que mudam
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
    
    if (!over) {
      return;
    }

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

    // 1. Atualiza o estado localmente para feedback instantâneo
    setLocalTasks(prevTasks => {
      const tasksInSource = prevTasks.filter(t => t.status === sourceStatus).sort((a, b) => a.order_index - b.order_index);
      const tasksInTarget = prevTasks.filter(t => t.status === targetStatus).sort((a, b) => a.order_index - b.order_index);
      
      let newTasksInTarget: ClientTask[] = [...tasksInTarget];
      let newTasksInSource: ClientTask[] = [...tasksInSource];
      
      const updatesToSend: { taskId: string, newStatus: ClientTaskStatus, newOrderIndex: number }[] = [];
      
      // Caso 1: Movendo dentro da mesma coluna
      if (sourceStatus === targetStatus) {
        const oldIndex = tasksInSource.findIndex(t => t.id === activeId);
        const newIndex = tasksInSource.findIndex(t => t.id === overId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          newTasksInTarget = arrayMove(tasksInSource, oldIndex, newIndex);
        }
        newTasksInSource = [];
      } 
      // Caso 2: Movendo para uma coluna diferente
      else {
        newTasksInSource = tasksInSource.filter(t => t.id !== activeId);
        
        const overIndex = overId ? tasksInTarget.findIndex(t => t.id === overId) : -1;
        const insertIndex = overIndex === -1 ? tasksInTarget.length : overIndex;
        
        const taskToMove = { ...draggedTask, status: targetStatus };
        newTasksInTarget.splice(insertIndex, 0, taskToMove);
      }
      
      // 2. Recalcula os order_index e coleta as atualizações
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
      
      // 3. Envia a atualização para o DB (batch update)
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
    setLightboxUrl(url);
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
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-grow flex flex-col">
        <TabsList className="grid w-full grid-cols-3 bg-muted text-muted-foreground flex-shrink-0">
          <TabsTrigger value="kanban"><CalendarDays className="mr-2 h-4 w-4" /> Kanban</TabsTrigger>
          <TabsTrigger value="templates"><Repeat className="mr-2 h-4 w-4" /> Templates</TabsTrigger>
          <TabsTrigger value="vault"><Lock className="mr-2 h-4 w-4" /> Cofre</TabsTrigger>
        </TabsList>
        
        <TabsContent value="kanban" className="mt-4 flex-grow flex flex-col min-h-0">
          
          {/* Seletor de Mês */}
          <ClientMonthSelector currentMonthYear={currentMonthYear} onMonthChange={setCurrentMonthYear} />
          
          {/* Botão de Link de Aprovação */}
          {tasksUnderReview.length > 0 && (
            <div className="mb-4 flex-shrink-0 mt-4">
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
        
        <TabsContent value="vault" className="mt-4">
          <ClientVault clientId={clientId!} />
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
      
      {/* Modal para Edição de Tarefa */}
      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}</DialogTitle>
            <DialogDescription>
              {editingTask ? "Atualize os detalhes da tarefa do cliente." : "Defina uma nova tarefa para o seu dia."}
            </DialogDescription>
          </DialogHeader>
          <ClientTaskForm
            clientId={clientId!}
            initialData={editingTask ? { ...editingTask, due_date: editingTask.due_date || undefined } as any : { status: initialStatus }}
            onClientTaskSaved={handleTaskSaved}
            onClose={() => setIsTaskFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientKanban;