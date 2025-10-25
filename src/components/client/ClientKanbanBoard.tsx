// src/components/client/ClientKanbanBoard.tsx
"use client";

import React, { useMemo } from 'react';
import { DndContext, closestCorners, DragOverlay, useSensor, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { Loader2, Send, Copy, MessageSquare, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import ClientTaskCard from './ClientTaskCard';
import KanbanColumn from './ClientKanbanColumn';
import ClientMonthSelector from './ClientMonthSelector';
import { motion } from 'framer-motion';
import copy from 'copy-to-clipboard';
import { Input } from "@/components/ui/input";
import { showSuccess } from '@/utils/toast';
import { ClientKanbanHook, KANBAN_COLUMNS } from '@/hooks/useClientKanban';
import { ClientTaskStatus, ClientTask } from '@/types/client';

// Define custom sensors locally
const useMouseSensor = (options: any = {}) => useSensor(MouseSensor, options);
const useTouchSensor = (options: any = {}) => useSensor(TouchSensor, TouchSensor);

interface ClientKanbanBoardProps {
  hook: ClientKanbanHook;
  onAddTask: (status: ClientTaskStatus) => void;
  onEditTask: (task: ClientTask) => void;
  refetchTasks: () => void;
  // onImageClick: (url: string) => void; // Removido, pois o lightbox será local
}

const ClientKanbanBoard: React.FC<ClientKanbanBoardProps> = ({
  hook,
  onAddTask,
  onEditTask,
  refetchTasks,
}) => {
  const {
    tasksByStatus,
    isLoading,
    activeDragItem,
    handleDragStart,
    handleDragEnd,
    handleGenerateApprovalLink,
    currentMonthYear,
    setCurrentMonthYear,
    refetch, // Usar o refetch do hook
  } = hook;

  const [isLinkModalOpen, setIsLinkModalOpen] = React.useState(false);
  const [generatedLink, setGeneratedLink] = React.useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null); // Estado para Lightbox

  // DND Sensors
  const mouseSensor = useMouseSensor({ activationConstraint: { distance: 5 } });
  const touchSensor = useTouchSensor({ activationConstraint: { delay: 100, tolerance: 5 } });
  const sensors = useMemo(() => [mouseSensor, touchSensor], [mouseSensor, touchSensor]);
  
  const tasksUnderReview = tasksByStatus.get('under_review') || [];

  const handleGenerateLinkClick = async () => {
    try {
      const link = await handleGenerateApprovalLink.mutateAsync();
      if (link) {
        setGeneratedLink(link);
        setIsLinkModalOpen(true);
      }
    } catch (e) {
      // Error handled in hook mutation onError
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

  return (
    <div className="flex-grow flex flex-col min-h-0">
      
      {/* Seletor de Mês */}
      <ClientMonthSelector currentMonthYear={currentMonthYear} onMonthChange={setCurrentMonthYear} />
      
      {/* Botão de Link de Aprovação */}
      {tasksUnderReview.length > 0 && (
        <div className="mb-4 flex-shrink-0 mt-4">
          <Button 
            onClick={handleGenerateLinkClick} 
            disabled={handleGenerateApprovalLink.isPending}
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
      ) : (
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col sm:flex-row sm:overflow-x-auto sm:space-x-4 pb-4 custom-scrollbar w-full flex-grow min-h-[50vh] space-y-4 sm:space-y-0">
            {KANBAN_COLUMNS.map(column => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={tasksByStatus.get(column.id) || []}
                onAddTask={onAddTask}
                onEditTask={onEditTask}
                refetchTasks={refetch} // Usando o refetch do hook
                onImageClick={setLightboxUrl} // Passando o setter do lightbox
              />
            ))}
          </div>
          
          <DragOverlay>
            {activeDragItem ? (
              <ClientTaskCard 
                task={activeDragItem as ClientTask} 
                onEdit={onEditTask} 
                refetchTasks={refetch}
                onImageClick={setLightboxUrl}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modal de Link de Aprovação */}
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

export default ClientKanbanBoard;