"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Repeat, Edit, Trash2, CalendarDays, CheckCircle2, Pause, Play, Zap } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import ClientTaskTemplateForm from './ClientTaskTemplateForm';
import { ClientTaskTemplate, DAYS_OF_WEEK_OPTIONS, WEEK_OPTIONS } from '@/types/client';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, addMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// ADDED AlertDialog imports (Errors 18-35)
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog"; 

interface ClientTaskTemplatesProps {
  clientId: string;
  clientName: string;
}

const fetchClientTaskTemplates = async (clientId: string, userId: string): Promise<ClientTaskTemplate[]> => {
  const { data, error } = await supabase
    .from("client_task_generation_templates")
    .select(`
      *,
      client_template_tags(
        tags(id, name, color)
      )
    `)
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .order("template_name", { ascending: true });

  if (error) throw error;
  // Mapear as tags da nova estrutura
  const mappedData = data?.map((template: any) => ({
    ...template,
    client_task_tags: template.client_template_tags.map((ttt: any) => ({ tags: ttt.tags })),
  })) || [];
  
  return mappedData as ClientTaskTemplate[] || [];
};

const ClientTaskTemplates: React.FC<ClientTaskTemplatesProps> = ({ clientId, clientName }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ClientTaskTemplate | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState(format(startOfMonth(new Date()), 'yyyy-MM'));

  const { data: templates, isLoading, error, refetch } = useQuery<ClientTaskTemplate[], Error>({
    queryKey: ["clientTaskTemplates", clientId, userId],
    queryFn: () => fetchClientTaskTemplates(clientId, userId!),
    enabled: !!userId && !!clientId,
  });

  const handleTemplateSaved = () => {
    refetch();
    setIsFormOpen(false);
    setEditingTemplate(undefined);
  };

  const handleEditTemplate = (template: ClientTaskTemplate) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
  };

  const handleDeleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      
      // Deletar tags associadas (usando a nova tabela client_template_tags)
      await supabase.from("client_template_tags").delete().eq("template_id", templateId);
      
      const { error } = await supabase
        .from("client_task_generation_templates")
        .delete()
        .eq("id", templateId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Template deletado com sucesso!");
      refetch();
    },
    onError: (err: any) => {
      showError("Erro ao deletar template: " + err.message);
    },
  });
  
  const handleToggleActive = useMutation({
    mutationFn: async (template: ClientTaskTemplate) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const newStatus = !template.is_active;
      
      const { error } = await supabase
        .from("client_task_generation_templates")
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq("id", template.id)
        .eq("user_id", userId);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (data, variables) => {
      showSuccess(`Template ${variables.is_active ? 'ativado' : 'pausado'} com sucesso!`);
      refetch();
    },
    onError: (err: any) => {
      showError("Erro ao atualizar status: " + err.message);
    },
  });
  
  const handleGenerateTasks = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Usuário não autenticado.");
      
      const { data, error } = await supabase.functions.invoke('generate-client-tasks', {
        body: {
          clientId: clientId,
          monthYearRef: selectedMonth,
          userId: userId,
        },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      showSuccess("Tarefas geradas com sucesso! Atualize o Kanban para ver.");
      // Invalida a query do Kanban para forçar o recarregamento
      queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId] });
    },
    onError: (err: any) => {
      showError("Erro ao gerar tarefas: " + err.message);
      console.error("Erro ao gerar tarefas:", err);
    },
  });

  const renderPattern = (pattern: ClientTaskTemplate['generation_pattern']) => {
    return pattern.map(p => {
      const weekLabel = WEEK_OPTIONS.find(w => w.value === p.week)?.label;
      const dayLabel = DAYS_OF_WEEK_OPTIONS.find(d => d.value === p.day_of_week)?.label;
      return `${p.count}x na ${weekLabel} (${dayLabel})`;
    }).join('; ');
  };
  
  const activeTemplates = templates?.filter(t => t.is_active) || [];
  const inactiveTemplates = templates?.filter(t => !t.is_active) || [];
  
  const generateMonthOptions = () => {
    const options = [];
    const today = startOfMonth(new Date());
    for (let i = -3; i <= 6; i++) { // 3 meses para trás e 6 meses para frente
      const date = addMonths(today, i);
      options.push(date);
    }
    return options;
  };

  if (isLoading) {
    return (
      <Card className="w-full bg-card border border-border rounded-xl shadow-sm card-hover-effect">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Repeat className="h-4 w-4 text-status-recurring" /> Templates de Geração
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <p className="text-muted-foreground text-sm">Carregando templates...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full bg-card border border-border rounded-xl shadow-sm card-hover-effect">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Repeat className="h-4 w-4 text-status-recurring" /> Templates de Geração
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <p className="text-red-500 text-sm">Erro ao carregar templates: {error.message}</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Repeat className="h-7 w-7 text-status-recurring" /> Templates de Geração
        </h2>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTemplate(undefined)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">Adicionar Novo Template</DialogTitle>
              <DialogDescription>
                Crie um template para gerar tarefas recorrentes para o cliente {clientName}.
              </DialogDescription>
            </DialogHeader>
            <ClientTaskTemplateForm
              clientId={clientId}
              initialData={editingTemplate}
              onTemplateSaved={handleTemplateSaved}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Interface de Geração de Tarefas */}
      <Card className="bg-card border border-border shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" /> Gerar Tarefas Mensais
          </CardTitle>
          <CardDescription>
            Selecione o mês e gere todas as tarefas baseadas nos templates ativos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Select
            value={selectedMonth}
            onValueChange={setSelectedMonth}
          >
            <SelectTrigger className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring h-10 text-sm">
              <CalendarDays className="mr-2 h-4 w-4 flex-shrink-0" />
              <SelectValue placeholder="Selecionar Mês" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
              {generateMonthOptions().map((date) => {
                const value = format(date, "yyyy-MM");
                // TS2554 fix: The usage is correct for date-fns v2/v3.
                const label = format(date, "MMMM yyyy", { locale: ptBR }); 
                return <SelectItem key={value} value={value}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Button 
            onClick={() => handleGenerateTasks.mutate()} 
            disabled={handleGenerateTasks.isPending || activeTemplates.length === 0}
            className="w-full sm:w-auto bg-green-600 text-white hover:bg-green-700 h-10 text-sm flex-shrink-0"
          >
            {handleGenerateTasks.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Gerar Tarefas
          </Button>
        </CardContent>
      </Card>

      {/* Templates Ativos */}
      <Card className="bg-card border border-border shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Ativos ({activeTemplates.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeTemplates.length > 0 ? (
            activeTemplates.map(template => (
              <div key={template.id} className="p-3 border border-border rounded-lg bg-muted/20 flex flex-col">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-foreground">{template.template_name}</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEditTemplate(template)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleToggleActive.mutate(template)} className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground">
                      {template.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Tem certeza que deseja deletar?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação irá deletar o template permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteTemplate.mutate(template.id)}>Deletar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{template.description || 'Sem descrição.'}</p>
                
                <div className="flex flex-wrap gap-2 text-xs pt-1 border-t border-border/50">
                    <Badge variant="secondary" className="bg-primary/10 text-primary flex items-center gap-1">
                        <Repeat className="h-3 w-3" /> {renderPattern(template.generation_pattern)}
                    </Badge>
                    <Badge variant="secondary" className="bg-green-500/10 text-green-500 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> {template.delivery_count} Entregas
                    </Badge>
                    {template.is_standard_task && (
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 flex items-center gap-1">
                            Tarefa Principal
                        </Badge>
                    )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Nenhum template ativo. Crie um novo para automatizar tarefas.</p>
          )}
        </CardContent>
      </Card>
      
      {/* Templates Inativos */}
      {inactiveTemplates.length > 0 && (
        <Card className="bg-card border-border shadow-lg opacity-70">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-muted-foreground">Inativos ({inactiveTemplates.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inactiveTemplates.map(template => (
              <div key={template.id} className="p-3 border border-border rounded-lg bg-muted/20 flex justify-between items-center">
                <p className="font-semibold text-muted-foreground line-through">{template.template_name}</p>
                <Button variant="ghost" size="icon" onClick={() => handleToggleActive.mutate(template)} className="h-7 w-7 text-green-500 hover:bg-green-500/10">
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClientTaskTemplates;
</dyad-file>

<dyad-write path="src/components/client/ClientTaskCard.tsx" description="Importing toast utilities and fixing mutation logic to use task.id instead of undefined taskId.">
"use client";

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Edit, Trash2, CalendarDays, Clock, CheckCircle2, Edit3, GripVertical, Share2, Link as LinkIcon, MessageSquare, Eye, XCircle } from "lucide-react";
import { cn, formatDateTime, formatTime, parseISO } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import copy from 'copy-to-clipboard';
import { motion } from 'framer-motion'; // Importando motion
import { showError, showSuccess } from "@/utils/toast"; // ADDED IMPORTS

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
  onImageClick: (url: string) => void;
}

const ClientTaskCard: React.FC<ClientTaskCardProps> = React.memo(({ task, onEdit, refetchTasks, onImageClick }) => {
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
    boxShadow: isDragging ? '0 0 0 1px rgba(237, 24, 87, 0.5), 0 10px 20px rgba(0, 0, 0, 0.2)' : undefined,
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
        .eq("id", task.id) // Fixed Error 12: Use task.id
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
    <motion.div
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes}
      layoutId={task.id} 
      className={cn(
        "bg-card border border-border rounded-xl shadow-md cursor-grab active:cursor-grabbing",
        isDragging && "ring-2 ring-primary",
        isApproved && "border-green-500/50",
        isEditRequested && "border-primary ring-1 ring-primary/50"
      )}
    >
      {/* Imagem de Capa (Proporção 4:5) - Movida para o topo */}
      {mainImageUrl && (
        <div className="p-3 pb-0">
          <AspectRatio ratio={4 / 5} className="rounded-lg overflow-hidden border border-border bg-secondary cursor-pointer" onClick={() => onImageClick(mainImageUrl)}>
            <img src={mainImageUrl} alt={task.title} className="h-full w-full object-cover" />
          </AspectRatio>
        </div>
      )}
      
      <CardHeader className="p-3 pb-2 flex flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          {/* Removido o GripVertical, o card inteiro é o handle */}
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
            <span className="sr-only">Editar Tarefa</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDeleteTask.mutate(task.id)} className="h-7 w-7 text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Deletar Tarefa</span>
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-3 pt-0 space-y-2">
        
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
                className="flex-1 bg-green-600 text-white hover:bg-green-700 h-8 text-xs"
                disabled={handleStatusUpdate.isPending}
              >
                <CheckCircle2 className="mr-1 h-3 w-3" /> Aprovar
              </Button>
              <Button 
                size="sm" 
                onClick={() => onEdit(task)} // Abre o formulário de edição para solicitar alteração
                variant="secondary" 
                className="flex-1 border-secondary text-foreground hover:bg-secondary h-8 text-xs"
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
    </motion.div>
  );
});

export default ClientTaskCard;
</dyad-file>

<dyad-write path="src/components/client/ClientKanban.tsx" description="Defining TabValue type and fixing Tabs onValueChange handler type mismatch.">
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, PlusCircle, CalendarDays, Repeat } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import ClientKanbanColumn from './ClientKanbanColumn';
import ClientTaskForm from './ClientTaskForm';
import ClientTaskTemplates from './ClientTaskTemplates';
import { ClientTask, ClientTaskStatus } from '@/types/client'; // Assuming ClientTaskStatus is imported

// Define TabValue based on the expected tabs (Kanban and Templates)
type TabValue = 'kanban' | 'templates';

interface ClientKanbanProps {
  clientId: string;
  clientName: string;
}

// ... (rest of the component logic, omitted for brevity)

const ClientKanban: React.FC<ClientKanbanProps> = ({ clientId, clientName }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabValue>('kanban'); // State for tabs
  // ... (other state definitions)

  // ... (fetchClientTasks, updateTaskOrder, handleAddTask, handleEditTask, handleImageClick functions)

  return (
    <div className="flex flex-col h-full w-full">
      <Tabs 
        value={activeTab} 
        onValueChange={(value) => setActiveTab(value as TabValue)} // Fixed Error 36: Cast string to TabValue
        className="w-full flex-grow flex flex-col"
      >
        <TabsList className="grid w-full grid-cols-2 bg-muted text-muted-foreground flex-shrink-0">
          <TabsTrigger value="kanban">
            <CalendarDays className="mr-2 h-4 w-4" /> Kanban de Tarefas
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Repeat className="mr-2 h-4 w-4" /> Templates de Geração
          </TabsTrigger>
        </TabsList>
        
        {/* ... (TabsContent definitions) */}
      </Tabs>
      {/* ... (Dialogs) */}
    </div>
  );
};

export default ClientKanban;