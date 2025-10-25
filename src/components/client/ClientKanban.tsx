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
import { Button } from '@/components/ui/button'; // Importação adicionada

type TabValue = "kanban" | "templates" | "vault";

const ClientKanban: React.FC = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  if (!clientId) {
    return <div>ID do cliente não encontrado.</div>;
  }

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("kanban");

  const {
    isLoading,
    isError,
    errorMessage,
    tasks,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
  } = useClientKanban(clientId);

  const handleTabChange = (value: TabValue) => {
    setActiveTab(value);
    // Use navigate para atualizar a URL sem recarregar a página
    navigate(`?tab=${value}`, { replace: true });
  };

  // Use useMemo para derivar o valor do parâmetro de consulta 'tab' da URL
  const currentTab = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return (searchParams.get("tab") as TabValue) || "kanban";
  }, [location.search]);

  const renderTabContent = () => {
    switch (currentTab) {
      case "kanban":
        return <ClientKanbanBoard
          tasks={tasks}
          isLoading={isLoading}
          isError={isError}
          errorMessage={errorMessage}
          onMoveTask={moveTask}
          onDeleteTask={deleteTask}
          onUpdateTask={updateTask}
        />;
      case "templates":
        return <ClientTaskTemplates clientId={clientId} onTaskCreated={addTask} />;
      case "vault":
        return <ClientVault clientId={clientId} />;
      default:
        return <div>Conteúdo não encontrado</div>;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...</div>;
  }

  if (isError) {
    return <div>Erro: {errorMessage}</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <ClientKanbanHeader clientId={clientId} />

      {/* Tabs */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="flex-1">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="vault">Vault</TabsTrigger>
        </TabsList>
        <TabsContent value="kanban" className="outline-none">
          {renderTabContent()}
        </TabsContent>
        <TabsContent value="templates" className="outline-none">
          {renderTabContent()}
        </TabsContent>
        <TabsContent value="vault" className="outline-none">
          {renderTabContent()}
        </TabsContent>
      </Tabs>

      {/* Modal de Criação de Task */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle>Criar Nova Task</DialogTitle>
            <DialogDescription>Preencha os campos abaixo para criar uma nova task.</DialogDescription>
          </DialogHeader>
          <ClientTaskForm clientId={clientId} onSubmit={addTask} onCancel={() => setOpen(false)} />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute top-2 right-2"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientKanban;
}