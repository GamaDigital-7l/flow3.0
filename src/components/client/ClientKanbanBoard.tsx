// src/components/client/ClientKanbanBoard.tsx
"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { DndContext, closestCorners, DragOverlay, useSensor, useSensors, MouseSensor, TouchSensor, DragEndEvent, UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Send, Copy, MessageSquare, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import ClientTaskCard from './ClientTaskCard';
import KanbanColumn from './KanbanColumn';
import ClientMonthSelector from './ClientMonthSelector';
import { useClientKanban, ClientKanbanHook } from '@/hooks/useClientKanban';
import { ClientTaskStatus, ClientTask } from '@/types/client';
import { motion } from 'framer-motion';
import { Input } from "@/components/ui/input";
import { showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface ClientKanbanBoardProps {
  hook: ClientKanbanHook;
  onAddTask: (status: ClientTaskStatus) => void;
  onEditTask: (task: ClientTask) => void;
  refetchTasks: () => void;
  onImageClick: (url: string) => void;
}

const ClientKanbanBoard: React.FC<ClientKanbanBoardProps> = React.memo(({
  hook,
  onAddTask,
  onEditTask,
  refetchTasks,
  onImageClick,
}) => {
  const {
    client,
    tasksByStatus,
    isLoading,
    error,
    refetch,
    KANBAN_COLUMNS,
    activeDragItem,
    handleDragStart,
    handleDragEnd,
    handleGenerateApprovalLink,
    currentMonthYear,
    setCurrentMonthYear,
  } = hook;

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const kanbanContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowRightArrow] = useState(false);

  // DND Sensors
  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } });
  const sensors = useSensors(mouseSensor, touchSensor);
  
  const tasksUnderReview = tasksByStatus.get('under_review') || [];

  const handleGenerateLinkClick = async () => {
    try {
      const link = await handleGenerateApprovalLink.mutateAsync();
      if (link) {
        setGeneratedLink(link);
        setIsLinkModalOpen(true);
      }
    } catch (e) {
      // Error handled in hook mutationOnError
    }
  };
  
  const handleCopyLink = (link: string, message: boolean = false) => {
    if (message) {
      const whatsappMessage = `Olá! Segue o link para aprovação dos posts de ${currentMonthYear}: ${link}`;
      copy(whatsappMessage);
      showSuccess("Mensagem e link copiados para o WhatsApp!");
    } else {
      copy(link);
      showSuccess("Link copiado!");
    }
  };

  const handleScroll = () => {
    if (kanbanContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = kanbanContainerRef.current;
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth);
    }
  };

  useEffect(() => {
    handleScroll(); // Initial check
    const container = kanbanContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scroll = (scrollOffset: number) => {
    kanbanContainerRef.current?.scrollBy({ left: scrollOffset, behavior: 'smooth' });
  };

  return (
    <div className="flex-grow flex flex-col min-h-0">
      
      {/* Seletor de Mês */}
      <ClientMonthSelector currentMonthYear={currentMonthYear} onMonthChange={setCurrentMonthYear} />
      
      {/* Botão de Link de Aprovação */}
      {tasksUnderReview.length > 0 && (
        <div className="mb-4 flex-shrink-0 mt-4">
          <Button 
            onClick={handleGenerateLinkClick} 
            disabled={handleGenerateApprovalLink.isPending || !tasksByStatus.get('under_review')?.filter(t => t.public_approval_enabled).length}
            className="w-full bg-primary text-white hover:bg-primary/90"
          >
            {handleGenerateApprovalLink.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Gerar Link de Aprovação ({tasksUnderReview.filter(t => t.public_approval_enabled).length} itens)
          </Button>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="p-4 text-red-500">Erro ao carregar tarefas.</div>
      ) : (
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Container de Scroll Horizontal */}
          <div className="relative">
            {showLeftArrow && (
              <Button variant="ghost" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-card/80 text-muted-foreground hover:text-foreground hover:bg-accent" onClick={() => scroll(-200)}>
                <ChevronLeft className="h-5 w-5" />
                <span className="sr-only">Scroll para a esquerda</span>
              </Button>
            )}
            {showRightArrow && (
              <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-card/80 text-muted-foreground hover:text-foreground hover:bg-accent" onClick={() => scroll(200)}>
                <ChevronRight className="h-5 w-5" />
                <span className="sr-only">Scroll para a direita</span>
              </Button>
            )}
            <div
              ref={kanbanContainerRef}
              className="flex gap-4 pb-4 w-full flex-grow min-h-[50vh] overflow-x-auto scroll-smooth snap-mandatory snap-x"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {KANBAN_COLUMNS.map(column => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={tasksByStatus.get(column.id) || []}
                  onAddTask={onAddTask}
                  onEditTask={onEditTask}
                  refetchTasks={refetch}
                  onImageClick={onImageClick}
                />
              ))}
            </div>
          </div>
          
          <DragOverlay>
            {activeDragItem ? (
              <ClientTaskCard 
                task={activeDragItem as ClientTask} 
                onEdit={onEditTask} 
                refetchTasks={refetch}
                onImageClick={onImageClick}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modal de Link de Aprovação (mantido) */}
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
              <Button onClick={() => handleCopyLink(generatedLink || '', true)} className="w-1/2 bg-green-500 text-white hover:bg-green-700">
                <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default ClientKanbanBoard;