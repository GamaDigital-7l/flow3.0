// src/components/client/ClientKanban.tsx
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Repeat, CalendarDays, Lock, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import ClientTaskForm from './ClientTaskForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClientTaskTemplates from './ClientTaskTemplates';
import ClientVault from './ClientVault';
import ClientKanbanHeader from './ClientKanbanHeader';
import ClientKanbanBoard from './ClientKanbanBoard';
import { useClientKanban } from '@/hooks/useClientKanban';
import { ClientTaskStatus, ClientTask } from '@/types/client';
import { motion } from 'framer-motion';

type TabValue = "kanban" | "templates" | "vault";

const ClientKanban: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const location = useLocation();
  
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ClientTask | undefined>(undefined);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [initialStatus, setInitialStatus] = useState<ClientTaskStatus | undefined>(undefined);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>("kanban");
  
  // Usando o novo hook para toda a lógica de dados e DND
  const kanbanHook = useClientKanban(clientId!);

  // Extraindo estados e funções do hook
  const { client, isLoading, error, refetch } = kanbanHook;

  const handleTaskSaved = () => {
    kanbanHook.refetch();
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
  
  const handleImageClick = useCallback((url: string) => {
    setLightboxUrl(url);
  }, []);

  // Efeito para abrir o formulário de edição se um taskId for passado na URL
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const taskIdFromUrl = params.get('openTaskId');
    
    if (taskIdFromUrl && kanbanHook.tasksByStatus && !openTaskId) {
      // Busca em todas as colunas
      const allTasks = Array.from(kanbanHook.tasksByStatus.values()).flat();
      const taskToEdit = allTasks.find(t => t.id === taskIdFromUrl);
      if (taskToEdit) {
        setOpenTaskId(taskIdFromUrl);
        handleEditTask(taskToEdit);
      }
    }
  }, [location.search, kanbanHook.tasksByStatus, openTaskId, handleEditTask]);

  if (isLoading && !client) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando workspace...
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 p-4">Erro ao carregar cliente: {error.message}</p>;
  }

  if (!client) {
    return <p className="text-red-500 p-4">Cliente não encontrado.</p>;
  }

  return (
    <div className="flex flex-col h-full">
      <ClientKanbanHeader client={client} />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-grow flex flex-col">
        <TabsList className="grid w-full grid-cols-3 bg-muted text-muted-foreground flex-shrink-0">
          <TabsTrigger value="kanban"><CalendarDays className="mr-2 h-4 w-4" /> Kanban</TabsTrigger>
          <TabsTrigger value="templates"><Repeat className="mr-2 h-4 w-4" /> Templates</TabsTrigger>
          <TabsTrigger value="vault"><Lock className="mr-2 h-4 w-4" /> Cofre</TabsTrigger>
        </TabsList>
        
        <TabsContent value="kanban" className="mt-4 flex-grow flex flex-col min-h-0">
          <ClientKanbanBoard 
            hook={kanbanHook}
            onAddTask={handleAddTaskInColumn}
            onEditTask={handleEditTask}
            refetchTasks={refetch}
            onImageClick={handleImageClick}
          />
        </TabsContent>
        
        <TabsContent value="templates" className="mt-4">
          <ClientTaskTemplates clientId={clientId!} clientName={client.name} />
        </TabsContent>
        
        <TabsContent value="vault" className="mt-4">
          <ClientVault clientId={clientId!} />
        </TabsContent>
      </Tabs>

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
      
      {/* Lightbox para Imagem */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="lightbox-fullscreen-override">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLightboxUrl(null)} 
            className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 h-10 w-10"
          >
            <X className="h-6 w-6" />
          </Button>
          {lightboxUrl && (
            <motion.img
              key={lightboxUrl}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
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