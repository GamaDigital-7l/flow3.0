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
import { Button } from '@/components/ui/button';

type TabValue = "kanban" | "templates" | "vault";

const ClientKanban: React.FC = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  if (!clientId) {
    return <div>ID do cliente não encontrado.</div>;
  }

  const hook = useClientKanban(clientId);
  const { client, refetch: refetchKanbanTasks } = hook;

  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ClientTask | undefined>(undefined);
  const [initialStatus, setInitialStatus] = useState<ClientTaskStatus>('in_progress');

  // Use useMemo para derivar o valor do parâmetro de consulta 'tab' da URL
  const currentTab = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return (searchParams.get("tab") as TabValue) || "kanban";
  }, [location.search]);

  const handleTabChange = (value: TabValue) => {
    // Use navigate para atualizar a URL sem recarregar a página
    navigate(`?tab=${value}`, { replace: true });
  };
  
  const handleTaskSaved = () => {
    refetchKanbanTasks();
    setIsTaskFormOpen(false);
    setEditingTask(undefined);
  };
  
  const handleAddTask = (status: ClientTaskStatus) => {
    setEditingTask(undefined);
    setInitialStatus(status);
    setIsTaskFormOpen(true);
  };
  
  const handleEditTask = (task: ClientTask) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };
  
  const handleRefetchAll = () => {
    refetchKanbanTasks();
    // Refetch templates and vault data if needed, but rely on query keys for now
  };

  const renderTabContent = () => {
    switch (currentTab) {
      case "kanban":
        return <ClientKanbanBoard
          hook={hook}
          onAddTask={handleAddTask}
          onEditTask={handleEditTask}
          refetchTasks={handleRefetchAll}
          onImageClick={(url) => { /* Lightbox logic handled in board component */ }}
        />;
      case "templates":
        return <ClientTaskTemplates clientId={clientId} clientName={client?.name || 'Cliente'} />;
      case "vault":
        return <ClientVault clientId={clientId} />;
      default:
        return <div>Conteúdo não encontrado</div>;
    }
  };

  if (hook.isLoading) {
    return (
      <div className="page-content-wrapper flex items-center justify-center h-full min-h-[50vh]">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" /> Carregando workspace...
      </div>
    );
  }

  if (hook.error || !client) {
    return (
      <div className="page-content-wrapper">
        <h1 className="text-3xl font-bold text-red-500">Erro ao Carregar Cliente</h1>
        <p className="text-lg text-muted-foreground">O cliente não foi encontrado ou ocorreu um erro: {hook.error?.message}</p>
        <Button onClick={() => navigate('/clients')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="page-content-wrapper flex flex-col h-full min-h-screen">
      {/* Header */}
      <ClientKanbanHeader client={client} />

      {/* Tabs */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="flex-1 mt-4">
        <TabsList className="grid w-full grid-cols-3 bg-muted text-muted-foreground">
          <TabsTrigger value="kanban" className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Kanban</TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2"><Repeat className="h-4 w-4" /> Templates</TabsTrigger>
          <TabsTrigger value="vault" className="flex items-center gap-2"><Lock className="h-4 w-4" /> Cofre</TabsTrigger>
        </TabsList>
        
        <TabsContent value={currentTab} className="outline-none pt-4">
          {renderTabContent()}
        </TabsContent>
      </Tabs>

      {/* Modal de Criação/Edição de Task */}
      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingTask ? "Atualize os detalhes da sua tarefa." : "Defina uma nova tarefa para o cliente."}
            </DialogDescription>
          </DialogHeader>
          <ClientTaskForm
            clientId={clientId}
            initialData={editingTask || { status: initialStatus }}
            onClientTaskSaved={handleTaskSaved}
            onClose={() => setIsTaskFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientKanban;