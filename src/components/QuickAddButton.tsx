"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, ListTodo, NotebookText, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/integrations/supabase/auth";

import TaskForm from "@/components/TaskForm";
import NoteForm from "@/components/NoteForm";
import ClientForm from "@/components/client/ClientForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";

const QuickAddButton: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isNoteFormOpen, setIsNoteFormOpen] = useState(false);
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);

  const handleTaskSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    queryClient.invalidateQueries({ queryKey: ["dashboardTasks"] });
    setIsTaskFormOpen(false);
  };

  const handleNoteSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["notes"] });
    setIsNoteFormOpen(false);
  };

  const handleClientSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    setIsClientFormOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 z-50"
            size="icon"
          >
            <Plus className="h-6 w-6" />
            <span className="sr-only">Adicionar Novo</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56 mb-2 bg-popover border-border">
          <DropdownMenuItem onSelect={() => setIsTaskFormOpen(true)} className="cursor-pointer">
            <ListTodo className="mr-2 h-4 w-4" />
            <span>Nova Tarefa</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setIsNoteFormOpen(true)} className="cursor-pointer">
            <NotebookText className="mr-2 h-4 w-4" />
            <span>Nova Nota</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setIsClientFormOpen(true)} className="cursor-pointer">
            <Users className="mr-2 h-4 w-4" />
            <span>Novo Cliente</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Task Form Dialog */}
      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle>Adicionar Nova Tarefa</DialogTitle>
            <DialogDescription>Crie uma nova tarefa para organizar seu dia.</DialogDescription>
          </DialogHeader>
          <TaskForm onTaskSaved={handleTaskSaved} onClose={() => setIsTaskFormOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Note Form Dialog */}
      <Dialog open={isNoteFormOpen} onOpenChange={setIsNoteFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle>Criar Nova Nota</DialogTitle>
            <DialogDescription>Escreva uma nova nota para o seu segundo cérebro.</DialogDescription>
          </DialogHeader>
          <NoteForm onNoteSaved={handleNoteSaved} onClose={() => setIsNoteFormOpen(false)} userId={userId} />
        </DialogContent>
      </Dialog>

      {/* Client Form Dialog */}
      <Dialog open={isClientFormOpen} onOpenChange={setIsClientFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle>Adicionar Novo Cliente</DialogTitle>
            <DialogDescription>Adicione um novo cliente para gerenciar suas tarefas.</DialogDescription>
          </DialogHeader>
          <ClientForm onClientSaved={handleClientSaved} onClose={() => setIsClientFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuickAddButton;