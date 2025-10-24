"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Edit, ArrowLeft, Send, Users, Clock, MessageSquare } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { format, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { cn, formatDateTime } from '@/lib/utils';
import { AspectRatio } from '@/components/ui/aspect-ratio';

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
}

interface PublicApprovalLink {
  id: string;
  unique_id: string;
  client_id: string;
  user_id: string;
  month_year_reference: string;
  expires_at: string;
  is_active: boolean;
}

interface ApprovalData {
  link: PublicApprovalLink;
  client: { name: string; logo_url: string | null };
  tasks: ClientTask[];
}

const fetchApprovalData = async (uniqueId: string): Promise<ApprovalData | null> => {
  // 1. Fetch the active link
  const { data: linkData, error: linkError } = await supabase
    .from('public_approval_links')
    .select('*')
    .eq('unique_id', uniqueId)
    .eq('is_active', true)
    .single();

  if (linkError || !linkData) {
    if (linkError && linkError.code !== 'PGRST116') console.error("Link fetch error:", linkError);
    return null;
  }
  
  const link = linkData as PublicApprovalLink;
  
  if (isPast(parseISO(link.expires_at))) {
    // Mark link as inactive if expired (optional, but good practice)
    await supabase.from('public_approval_links').update({ is_active: false }).eq('id', link.id);
    return null;
  }

  // 2. Fetch client details
  const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .select('name, logo_url')
    .eq('id', link.client_id)
    .single();

  if (clientError || !clientData) {
    console.error("Client fetch error:", clientError);
    return null;
  }

  // 3. Fetch tasks for this client/month that are 'under_review' and enabled for public approval
  const { data: tasksData, error: tasksError } = await supabase
    .from('client_tasks')
    .select('*')
    .eq('client_id', link.client_id)
    .eq('user_id', link.user_id)
    .eq('month_year_reference', link.month_year_reference)
    .eq('public_approval_enabled', true)
    .in('status', ['under_review', 'edit_requested']) // Mostrar apenas tarefas que precisam de ação
    .order('order_index', { ascending: true });

  if (tasksError) {
    console.error("Tasks fetch error:", tasksError);
    return null;
  }

  return {
    link,
    client: clientData,
    tasks: tasksData as ClientTask[],
  };
};

const PublicApprovalPage: React.FC = () => {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const navigate = useNavigate();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'edit' | 'reject' | null>(null);
  const [editReason, setEditReason] = useState('');
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: approvalData, isLoading, error, refetch } = useQuery<ApprovalData | null, Error>({
    queryKey: ["publicApproval", uniqueId],
    queryFn: () => fetchApprovalData(uniqueId!),
    enabled: !!uniqueId,
    staleTime: 1000 * 60 * 5,
  });
  
  const handleAction = async (taskId: string, newStatus: ClientTaskStatus) => {
    if (!uniqueId || !approvalData) return;
    
    const reason = (newStatus === 'edit_requested' || newStatus === 'rejected') ? editReason : null;
    
    if ((newStatus === 'edit_requested' || newStatus === 'rejected') && !reason) {
        showError("Por favor, forneça um motivo para a solicitação.");
        return;
    }
    
    setIsSubmitting(true);

    try {
      // Chamada para a Edge Function para atualizar o status
      const { error: fnError } = await supabase.functions.invoke('update-client-task-status-public', {
        body: {
          uniqueId,
          taskId,
          newStatus,
          editReason: reason,
        },
      });

      if (fnError) throw fnError;
      
      showSuccess(`Tarefa ${newStatus === 'approved' ? 'Aprovada' : 'Edição Solicitada'} com sucesso!`);
      refetch();
      setIsModalOpen(false);
      setEditReason('');
      setCurrentTaskId(null);
    } catch (err: any) {
      showError("Erro ao processar ação: " + err.message);
      console.error("Erro ao processar ação:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openActionModal = (taskId: string, type: 'edit' | 'reject') => {
    setCurrentTaskId(taskId);
    setActionType(type);
    setEditReason('');
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !approvalData) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-red-500">Link Inválido ou Expirado</h1>
          <p className="text-lg text-muted-foreground mt-2">
            O link de aprovação não é válido, expirou ou não há tarefas pendentes para este período.
          </p>
          <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mt-8" />
        </div>
      </div>
    );
  }
  
  const { client, tasks, link } = approvalData;
  const tasksPendingAction = tasks.filter(t => t.status === 'under_review' || t.status === 'edit_requested');

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header do Cliente */}
        <Card className="bg-card border border-border rounded-xl shadow-lg">
          <CardHeader className="flex flex-row items-center gap-4">
            <img src={client.logo_url || "/placeholder.svg"} alt={client.name} className="h-12 w-12 rounded-full object-cover border border-border" />
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">Aprovação de Conteúdo</CardTitle>
              <CardDescription className="text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" /> Cliente: {client.name}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" /> Válido até: {formatDateTime(link.expires_at)}
            </p>
          </CardContent>
        </Card>

        {/* Lista de Tarefas Pendentes */}
        <h2 className="text-xl font-bold text-foreground">
          {tasksPendingAction.length > 0 ? `Itens Pendentes de Revisão (${tasksPendingAction.length})` : "Nenhum Item Pendente de Revisão"}
        </h2>
        
        {tasksPendingAction.length === 0 && (
          <Card className="bg-card border-dashed border-border shadow-sm p-8 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-4 text-green-500" />
            <CardTitle className="text-xl font-semibold text-foreground">Tudo Aprovado!</CardTitle>
            <CardDescription className="mt-2">Não há mais itens para sua revisão neste período.</CardDescription>
          </Card>
        )}

        <div className="space-y-6">
          {tasksPendingAction.map(task => (
            <Card key={task.id} className={cn(
              "bg-card border border-border rounded-xl shadow-lg",
              task.status === 'edit_requested' ? 'border-primary/50 ring-1 ring-primary/20' : '' // Usando primary para destaque
            )}>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg font-bold text-foreground">{task.title}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Vencimento: {task.due_date ? formatDateTime(task.due_date, false) : 'N/A'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-3">
                {/* Imagem de Capa (Proporção 4:5) */}
                {task.image_urls?.[0] && (
                  <AspectRatio ratio={4 / 5} className="rounded-md overflow-hidden border border-border bg-secondary">
                    <img src={task.image_urls[0]} alt={task.title} className="h-full w-full object-cover" />
                  </AspectRatio>
                )}
                
                {/* Descrição / Legenda */}
                {task.description && (
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-foreground">Legenda/Descrição:</h4>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  </div>
                )}
                
                {/* Status e Motivo de Edição */}
                {task.status === 'edit_requested' && (
                  <div className="p-3 bg-primary/10 border border-primary/30 rounded-md">
                    <p className="text-sm font-semibold text-primary flex items-center gap-1">
                      <Edit className="h-4 w-4" /> Edição Solicitada
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{task.edit_reason}</p>
                  </div>
                )}

                {/* Ações */}
                <div className="flex gap-3 pt-3 border-t border-border/50">
                  <Button 
                    onClick={() => handleAction(task.id, 'approved')} 
                    className="flex-1 bg-green-600 text-white hover:bg-green-700" // Mantido verde para aprovação final
                    disabled={isSubmitting}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
                  </Button>
                  <Button 
                    onClick={() => openActionModal(task.id, 'edit')} 
                    variant="secondary" // Usando secondary (cinza escuro)
                    className="flex-1 text-foreground hover:bg-secondary-hover"
                    disabled={isSubmitting}
                  >
                    <Edit className="mr-2 h-4 w-4" /> Solicitar Edição
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Modal para Solicitar Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Solicitar Edição</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Descreva as alterações necessárias para a tarefa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Ex: A cor do logo está errada, por favor, use o código #ED1857."
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              className="bg-input border-border text-foreground focus-visible:ring-ring"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => handleAction(currentTaskId!, 'edit_requested')} 
                className="bg-primary text-white hover:bg-primary/90" 
                disabled={!editReason || isSubmitting}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enviar Solicitação"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicApprovalPage;