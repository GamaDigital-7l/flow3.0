"use client";

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, CalendarDays, Clock, CheckCircle2, Edit3, GripVertical, Share2, Link as LinkIcon, MessageSquare, Eye } from 'lucide-react';
import { cn, formatDateTime, formatTime, parseISO } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/integrations/supabase/auth';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import copy from 'copy-to-clipboard';

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
  public_approval_link_id: string | null;
  tags?: { id: string; name: string; color: string }[];
}

interface ClientTaskCardProps {
  task: ClientTask;
  onEdit: (task: ClientTask) => void;
  refetchTasks: () => void;
}

const ClientTaskCard: React.FC<ClientTaskCardProps> = ({ task, onEdit, refetchTasks }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'ClientTask', task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    opacity: isDragging ? 0.8 : 1,
  };
  
  const handleDeleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      
      // Deletar tags associadas
      await supabase.from("client_task_tags").delete().eq("client_task_id", taskId);
      
      const { error } = await supabase
        .from("client_tasks")
        .delete()
        .eq("id", taskId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Tarefa deletada com sucesso!");
      refetchTasks();
    },
    onError: (err: any) => {
      showError("Erro ao deletar tarefa: " + err.message);
    },
  });

  const handleStatusUpdate = useMutation({
    mutationFn: async (newStatus: ClientTaskStatus) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      
      const isCompleted = newStatus === 'approved' || newStatus === 'posted';
      
      const { error } = await supabase
        .from("client_tasks")
        .update({ 
          status: newStatus, 
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id)
        .eq("user_id", userId);
      
      if (error) throw error;
    },
    onSuccess: (data, newStatus) => {
      showSuccess(`Status atualizado para ${newStatus}!`);
      refetchTasks();
    },
    onError: (err: any) => {
      showError("Erro ao atualizar status: " + err.message);
    },
  });
  
  const handleCopyApprovalLink = () => {
    if (!task.public_approval_link_id) {
      showError("Link de aprovação não gerado.");
      return;
    }
    const link = `${window.location.origin}/approval/${task.public_approval_link_id}`;
    copy(link);
    showSuccess("Link de aprovação copiado!");
  };

  const mainImageUrl = task.image_urls?.[0];
  const isUnderReview = task.status === 'under_review';
  const isApproved = task.status === 'approved';
  const isEditRequested = task.status === 'edit_requested';

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "bg-card border border-border rounded-xl shadow-md cursor-grab active:cursor-grabbing",
        isDragging && "ring-2 ring-primary",
        // Usando cores do tema para destaque de status
        isApproved && "border-green-500/50", // Mantido verde suave para aprovação
        isEditRequested && "border-primary ring-1 ring-primary/50" // Usando o rosa primário para edição solicitada
      )}
    >
      <CardHeader className="p-3 pb-2 flex flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <div {...listeners} {...attributes} className="cursor-grab p-1 -ml-1 text-muted-foreground hover:text-foreground">
            <GripVertical className="h-4 w-4" />
          </div>
          <CardTitle className="text-sm font-semibold text-foreground line-clamp-2 break-words">
            {task.title}
          </CardTitle>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {task.public_approval_enabled && task.public_approval_link_id && (
            <Button variant="ghost" size="icon" onClick={handleCopyApprovalLink} className="h-7 w-7 text-primary hover:bg-primary/10">
              <LinkIcon className="h-4 w-4" />
              <span className="sr-only">Copiar Link de Aprovação</span>
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => onEdit(task)} className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDeleteTask.mutate(task.id)} className="h-7 w-7 text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-3 pt-0 space-y-2">
        {/* Imagem de Capa (Proporção 4:5) */}
        {mainImageUrl && (
          <AspectRatio ratio={4 / 5} className="rounded-md overflow-hidden border border-border bg-secondary">
            <img src={mainImageUrl} alt={task.title} className="h-full w-full object-cover" />
          </AspectRatio>
        )}
        
        {/* Descrição / Legenda */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}
        
        {/* Metadados */}
        <div className="flex flex-wrap gap-1">
          {task.due_date && (
            <Badge variant="secondary" className="bg-muted/50 text-muted-foreground h-5 px-1.5 text-xs flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> {formatDateTime(task.due_date, false)}
            </Badge>
          )}
          {task.tags && task.tags.map(tag => (
            <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs flex-shrink-0 h-5 px-1.5">
              {tag.name}
            </Badge>
          ))}
        </div>
        
        {/* Ações Rápidas */}
        <div className="flex gap-2 pt-2 border-t border-border/50">
          {isUnderReview && (
            <>
              <Button 
                size="sm" 
                onClick={() => handleStatusUpdate.mutate('approved')} 
                className="flex-1 bg-primary text-white hover:bg-primary/90 h-8 text-xs" // Usando primary
                disabled={handleStatusUpdate.isPending}
              >
                <CheckCircle2 className="mr-1 h-3 w-3" /> Aprovar
              </Button>
              <Button 
                size="sm" 
                onClick={() => handleStatusUpdate.mutate('edit_requested')} 
                variant="outline" 
                className="flex-1 border-muted-foreground text-muted-foreground hover:bg-accent h-8 text-xs" // Usando neutro
                disabled={handleStatusUpdate.isPending}
              >
                <Edit3 className="mr-1 h-3 w-3" /> Editar
              </Button>
            </>
          )}
          {isApproved && (
            <Button 
              size="sm" 
              onClick={() => handleStatusUpdate.mutate('posted')} 
              className="w-full bg-primary text-white hover:bg-primary/90 h-8 text-xs"
              disabled={handleStatusUpdate.isPending}
            >
              <Share2 className="mr-1 h-3 w-3" /> Marcar como Postado
            </Button>
          )}
          {isEditRequested && (
            <Button 
              size="sm" 
              onClick={() => handleStatusUpdate.mutate('in_progress')} 
              className="w-full bg-primary text-white hover:bg-primary/90 h-8 text-xs"
              disabled={handleStatusUpdate.isPending}
            >
              <Edit3 className="mr-1 h-3 w-3" /> Retomar Edição
            </Button>
          )}
          {task.status === 'in_progress' && (
            <Button 
              size="sm" 
              onClick={() => handleStatusUpdate.mutate('under_review')} 
              className="w-full bg-primary text-white hover:bg-primary/90 h-8 text-xs"
              disabled={handleStatusUpdate.isPending}
            >
              <Eye className="mr-1 h-3 w-3" /> Enviar para Revisão
            </Button>
          )}
        </div>
        
        {isEditRequested && task.edit_reason && (
          <div className="p-2 bg-primary/10 border border-primary/30 rounded-md">
            <p className="text-xs font-semibold text-primary">Motivo da Edição:</p>
            <p className="text-xs text-muted-foreground mt-0.5">{task.edit_reason}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientTaskCard;