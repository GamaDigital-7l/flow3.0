"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClientTask, PublicApprovalLink, ClientTaskStatus } from '@/types/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Edit, ArrowLeft, Send } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface TaskDisplay extends ClientTask {
  is_selected: boolean;
}

const fetchApprovalData = async (uniqueId: string): Promise<PublicApprovalLink | null> => {
  const { data, error } = await supabase
    .from('public_approval_links')
    .select(`
      *,
      client:clients(id, name, logo_url),
      client_tasks:client_tasks!client_id(
        id, title, description, due_date, status, image_urls, edit_reason, public_approval_enabled
      )
    `)
    .eq('unique_id', uniqueId)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  
  if (data) {
    // Filter tasks to only include those enabled for public approval
    const tasksForApproval = data.client_tasks.filter(t => t.public_approval_enabled);
    return { ...data, client_tasks: tasksForApproval } as PublicApprovalLink;
  }
  return null;
};

const PublicApprovalPage: React.FC = () => {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const navigate = useNavigate();

  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentTaskToEdit, setCurrentTaskToEdit] = useState<TaskDisplay | null>(null);
  const [editReason, setEditReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: approvalData, isLoading, error, refetch } = useQuery<PublicApprovalLink | null, Error>({
    queryKey: ['publicApprovalData', uniqueId],
    queryFn: () => fetchApprovalData(uniqueId!),
    enabled: !!uniqueId,
    staleTime: 1000 * 60 * 5,
  });

  const tasks = approvalData?.client_tasks.map(t => ({
    ...t,
    is_selected: selectedTasks.includes(t.id),
  })) || [];

  const handleSelectTask = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTasks.length === tasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(tasks.map(t => t.id));
    }
  };

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, newStatus, reason }: { taskId: string; newStatus: ClientTaskStatus; reason?: string }) => {
      if (!uniqueId) throw new Error("ID de link ausente.");
      
      const { error: invokeError } = await supabase.functions.invoke('update-client-task-status-public', {
        body: {
          uniqueId: uniqueId,
          taskId: taskId,
          newStatus: newStatus,
          editReason: reason,
        },
      });

      if (invokeError) throw invokeError;
    },
    onSuccess: () => {
      refetch();
    },
    onError: (err: any) => {
      showError("Erro ao atualizar status: " + err.message);
    },
  });

  const handleApproveSelected = async () => {
    if (selectedTasks.length === 0) {
      showError("Selecione pelo menos uma tarefa para aprovar.");
      return;
    }
    if (!window.confirm(`Tem certeza que deseja aprovar ${selectedTasks.length} tarefa(s)?`)) return;

    setIsSubmitting(true);
    try {
      const approvalPromises = selectedTasks.map(taskId => 
        updateTaskStatus.mutateAsync({ taskId, newStatus: 'approved' })
      );
      await Promise.all(approvalPromises);
      showSuccess("Tarefas aprovadas com sucesso!");
      setSelectedTasks([]);
    } catch (e) {
      // Erro já tratado na mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = (task: TaskDisplay) => {
    setCurrentTaskToEdit(task);
    setEditReason(task.edit_reason || '');
    setIsEditModalOpen(true);
  };

  const handleRequestEdit = async () => {
    if (!currentTaskToEdit || editReason.trim().length < 5) {
      showError("Por favor, forneça um motivo detalhado para a edição (mínimo 5 caracteres).");
      return;
    }
    setIsSubmitting(true);
    try {
      await updateTaskStatus.mutateAsync({ 
        taskId: currentTaskToEdit.id, 
        newStatus: 'edit_requested', 
        reason: editReason 
      });
      showSuccess("Solicitação de edição enviada com sucesso!");
      setIsEditModalOpen(false);
    } catch (e) {
      // Erro já tratado na mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectTask = async (task: TaskDisplay) => {
    const reason = window.prompt("Por favor, insira o motivo da rejeição:");
    if (reason === null) return; // Cancelado
    if (reason.trim().length < 5) {
      showError("O motivo da rejeição deve ter pelo menos 5 caracteres.");
      return;
    }
    setIsSubmitting(true);
    try {
      await updateTaskStatus.mutateAsync({ 
        taskId: task.id, 
        newStatus: 'rejected', 
        reason: reason 
      });
      showSuccess("Tarefa rejeitada com sucesso!");
    } catch (e) {
      // Erro já tratado na mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Carregando tarefas para aprovação...</p>
      </div>
    );
  }

  if (error || !approvalData || !approvalData.client) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
        <XCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold mb-2">Link Inválido ou Expirado</h1>
        <p className="text-lg text-muted-foreground text-center">
          O link de aprovação que você está tentando acessar é inválido, expirou ou não contém tarefas para aprovação.
        </p>
      </div>
    );
  }

  const clientName = approvalData.client.name;
  const monthYear = format(new Date(approvalData.month_year_reference + '-01'), 'MMMM/yyyy', { locale: ptBR });
  const isExpired = new Date() > new Date(approvalData.expires_at);

  if (isExpired) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
        <XCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold mb-2">Link Expirado</h1>
        <p className="text-lg text-muted-foreground text-center">
          Este link de aprovação expirou em {format(new Date(approvalData.expires_at), 'PPP', { locale: ptBR })}. Por favor, solicite um novo link.
        </p>
      </div>
    );
  }

  const pendingTasks = tasks.filter(t => t.status === 'under_review');
  const approvedTasks = tasks.filter(t => t.status === 'approved' || t.status === 'posted');
  const actionTasks = tasks.filter(t => t.status === 'edit_requested' || t.status === 'rejected');

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8 p-4 bg-card rounded-xl shadow-lg border border-border">
          {approvalData.client.logo_url && (
            <img src={approvalData.client.logo_url} alt={clientName} className="h-12 w-12 object-contain rounded-full" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">Aprovação de Conteúdo</h1>
            <p className="text-muted-foreground">
              {clientName} - Entregas de {monthYear}
            </p>
          </div>
        </div>

        {pendingTasks.length > 0 && (
          <Card className="mb-6 bg-card border-border shadow-lg frosted-glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-semibold">
                {pendingTasks.length} Tarefa(s) Pendente(s)
              </CardTitle>
              <Button 
                onClick={handleApproveSelected} 
                disabled={selectedTasks.length === 0 || isSubmitting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Aprovar Selecionadas ({selectedTasks.length})
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <input 
                  type="checkbox" 
                  id="select-all" 
                  checked={selectedTasks.length === pendingTasks.length && pendingTasks.length > 0}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                />
                <label htmlFor="select-all" className="text-sm font-medium leading-none text-foreground">
                  Selecionar Todas
                </label>
              </div>
              {pendingTasks.map(task => (
                <TaskApprovalItem 
                  key={task.id} 
                  task={task as TaskDisplay} 
                  isSelected={selectedTasks.includes(task.id)}
                  onSelect={handleSelectTask}
                  onApprove={() => updateTaskStatus.mutate({ taskId: task.id, newStatus: 'approved' })}
                  onEditRequest={handleOpenEditModal}
                  onReject={handleRejectTask}
                  isSubmitting={isSubmitting}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {actionTasks.length > 0 && (
          <Card className="mb-6 bg-card border-border shadow-lg frosted-glass">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-orange-500 flex items-center gap-2">
                <Edit className="h-5 w-5" /> Ação Necessária ({actionTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {actionTasks.map(task => (
                <TaskApprovalItem 
                  key={task.id} 
                  task={task as TaskDisplay} 
                  isSelected={false}
                  onSelect={() => {}}
                  onApprove={() => updateTaskStatus.mutate({ taskId: task.id, newStatus: 'approved' })}
                  onEditRequest={handleOpenEditModal}
                  onReject={handleRejectTask}
                  isSubmitting={isSubmitting}
                  isActionRequired={true}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {approvedTasks.length > 0 && (
          <Card className="bg-card border-border shadow-lg frosted-glass">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-green-600 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" /> Aprovadas/Postadas ({approvedTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {approvedTasks.map(task => (
                <TaskApprovalItem 
                  key={task.id} 
                  task={task as TaskDisplay} 
                  isSelected={false}
                  onSelect={() => {}}
                  onApprove={() => {}}
                  onEditRequest={() => {}}
                  onReject={() => {}}
                  isSubmitting={false}
                  isCompleted={true}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {pendingTasks.length === 0 && approvedTasks.length === 0 && actionTasks.length === 0 && (
          <div className="text-center py-12 border border-dashed rounded-xl bg-card">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold">Todas as tarefas foram concluídas!</h2>
            <p className="text-muted-foreground">Não há mais tarefas pendentes de aprovação para este período.</p>
          </div>
        )}
      </div>

      {/* Modal de Solicitação de Edição */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle>Solicitar Edição</DialogTitle>
            <DialogDescription>
              Explique o que precisa ser ajustado na tarefa "{currentTaskToEdit?.title}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Detalhes da edição solicitada..."
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              rows={5}
            />
            <Button 
              onClick={handleRequestEdit} 
              disabled={isSubmitting || editReason.trim().length < 5}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit className="mr-2 h-4 w-4" />}
              Enviar Solicitação de Edição
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface TaskApprovalItemProps {
  task: TaskDisplay;
  isSelected: boolean;
  onSelect: (taskId: string) => void;
  onApprove: (task: TaskDisplay) => void;
  onEditRequest: (task: TaskDisplay) => void;
  onReject: (task: TaskDisplay) => void;
  isSubmitting: boolean;
  isActionRequired?: boolean;
  isCompleted?: boolean;
}

const TaskApprovalItem: React.FC<TaskApprovalItemProps> = ({ 
  task, 
  isSelected, 
  onSelect, 
  onApprove, 
  onEditRequest, 
  onReject, 
  isSubmitting,
  isActionRequired = false,
  isCompleted = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusMap: Record<ClientTaskStatus, { label: string; color: string }> = {
    pending: { label: "A Fazer", color: "bg-gray-500" },
    in_progress: { label: "Em Produção", color: "bg-blue-500" },
    under_review: { label: "Para Aprovação", color: "bg-yellow-500" },
    approved: { label: "Aprovado", color: "bg-green-600" },
    rejected: { label: "Rejeitado", color: "bg-red-600" },
    completed: { label: "Concluído", color: "bg-green-500" },
    edit_requested: { label: "Edição Solicitada", color: "bg-orange-500" },
    posted: { label: "Postado", color: "bg-purple-500" },
  };

  const currentStatus = statusMap[task.status] || statusMap.pending;

  return (
    <Card className={cn(
      "border rounded-lg transition-all duration-200",
      isCompleted ? "border-green-500/50 bg-green-500/10" : 
      isActionRequired ? "border-orange-500/50 bg-orange-500/10" : 
      isSelected ? "border-primary ring-2 ring-primary/50" : "border-border bg-muted/20"
    )}>
      <CardHeader className="p-3 flex flex-row items-start justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-start gap-3 min-w-0">
          {!isCompleted && !isActionRequired && (
            <input 
              type="checkbox" 
              checked={isSelected}
              onChange={() => onSelect(task.id)}
              className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary mt-1 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-semibold text-foreground break-words line-clamp-2">{task.title}</CardTitle>
            <p className={cn("text-xs font-medium mt-1", currentStatus.color)}>
              {currentStatus.label}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className="h-7 w-7 flex-shrink-0">
          {isExpanded ? <ArrowLeft className="h-4 w-4 rotate-90" /> : <ArrowLeft className="h-4 w-4 -rotate-90" />}
        </Button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-3 pt-0 space-y-3 border-t border-border">
          {task.due_date && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <CalendarDays className="h-4 w-4" /> Vencimento: {format(new Date(task.due_date), 'PPP', { locale: ptBR })}
            </p>
          )}
          {task.description && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Descrição:</h4>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </div>
          )}
          
          {task.image_urls && task.image_urls.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Anexos:</h4>
              <div className="flex flex-wrap gap-2">
                {task.image_urls.map((url, index) => (
                  <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="h-20 w-20 rounded-md overflow-hidden border border-border hover:opacity-80 transition-opacity">
                    <img src={url} alt={`Anexo ${index + 1}`} className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {task.edit_reason && (task.status === 'edit_requested' || task.status === 'rejected') && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-md">
              <h4 className="text-sm font-semibold text-red-500 mb-1">Motivo da {task.status === 'edit_requested' ? 'Edição Solicitada' : 'Rejeição'}:</h4>
              <p className="text-sm text-red-400">{task.edit_reason}</p>
            </div>
          )}

          {!isCompleted && (
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
              <Button 
                onClick={(e) => { e.stopPropagation(); onApprove(task); }} 
                disabled={isSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
              </Button>
              <Button 
                onClick={(e) => { e.stopPropagation(); onEditRequest(task); }} 
                disabled={isSubmitting}
                variant="outline"
                className="flex-1 border-orange-500 text-orange-500 hover:bg-orange-500/10"
              >
                <Edit className="mr-2 h-4 w-4" /> Solicitar Edição
              </Button>
              <Button 
                onClick={(e) => { e.stopPropagation(); onReject(task); }} 
                disabled={isSubmitting}
                variant="destructive"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                <XCircle className="mr-2 h-4 w-4" /> Rejeitar
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default PublicApprovalPage;