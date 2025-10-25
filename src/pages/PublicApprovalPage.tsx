"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Edit, FileText, Clock, AlertTriangle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { cn } from '@/lib/utils';

// Tipos
type ClientTaskStatus = "in_progress" | "under_review" | "approved" | "edit_requested" | "posted";
interface ClientTask {
  id: string;
  title: string;
  description: string | null;
  status: ClientTaskStatus;
  image_urls: string[] | null;
  client_id: string;
  edit_reason: string | null;
  clients: {
    name: string;
    logo_url: string | null;
  } | null;
}
interface ApprovalLinkData {
  tasks: ClientTask[];
  clientName: string;
  clientLogoUrl: string | null;
  isExpired: boolean;
  expirationDate: string | null;
}

// Função para buscar os dados no lado do cliente
const loadData = async (linkId: string): Promise<ApprovalLinkData> => {
  // 1. Buscar o link
  const { data: linkData, error: linkError } = await supabase
    .from('public_approval_links')
    .select('client_id, created_at')
    .eq('unique_id', linkId)
    .single();

  if (linkError || !linkData) {
    throw new Error('Link de aprovação inválido ou não encontrado.');
  }

  // 2. Verificar se o link expirou (7 dias)
  const createdAt = new Date(linkData.created_at);
  const expirationDate = addDays(createdAt, 7);
  const isExpired = new Date() > expirationDate;

  if (isExpired) {
    return {
      tasks: [],
      clientName: '',
      clientLogoUrl: null,
      isExpired: true,
      expirationDate: null,
    };
  }

  // 3. Buscar as tarefas associadas se o link for válido
  const { data: tasksData, error: tasksError } = await supabase
    .from('client_tasks')
    .select(`
      id, title, description, status, image_urls, client_id, edit_reason,
      clients (name, logo_url)
    `)
    .eq('public_approval_link_id', linkId)
    .in('status', ['under_review', 'edit_requested'])
    .order('order_index', { ascending: true });

  if (tasksError) {
    throw new Error('Erro ao buscar tarefas para aprovação.');
  }

  const client = tasksData?.[0]?.clients;

  return {
    tasks: tasksData || [],
    clientName: client?.name || 'Cliente',
    clientLogoUrl: client?.logo_url || null,
    isExpired: false,
    expirationDate: format(expirationDate, "dd 'de' MMMM 'de' yyyy, 'às' HH:mm", { locale: ptBR }),
  };
};

const PublicApprovalPage: React.FC = () => {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const navigate = useNavigate();
  const [editReason, setEditReason] = useState('');
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'reject' | 'edit' | null>(null);

  const { data, isLoading, error, refetch } = useQuery<ApprovalLinkData | null, Error>({
    queryKey: ["publicApproval", uniqueId],
    queryFn: () => loadData(uniqueId!),
    enabled: !!uniqueId,
  });

  const handleAction = async (newStatus: 'accepted' | 'rejected' | 'edit_requested') => {
    if (!uniqueId) {
      showError("Dados da proposta incompletos.");
      return;
    }

    const reason = (newStatus === 'rejected' || newStatus === 'edit_requested') ? editReason : null;
    
    if ((newStatus === 'rejected' || newStatus === 'edit_requested') && !reason) {
        showError("Por favor, forneça um motivo para a rejeição ou solicitação de edição.");
        return;
    }

    try {
      // Chamada para a Edge Function para atualizar o status e notificar
      const { error: fnError } = await supabase.functions.invoke('update-client-task-status-public', {
        body: {
          uniqueId: uniqueId,
          taskId: data.tasks[0].id,
          newStatus: newStatus,
          editReason: reason,
        },
      });

      if (fnError) {
        console.error("Erro ao atualizar status da tarefa via Edge Function:", fnError);
        showError("Erro ao processar ação. Tente novamente.");
        return;
      }

      showSuccess(`Tarefa ${newStatus === 'accepted' ? 'Aceita' : newStatus === 'rejected' ? 'Rejeitada' : 'Edição Solicitada'} com sucesso!`);
      refetch(); // Refetch para atualizar o estado
      setIsActionModalOpen(false);
      setEditReason('');
    } catch (err: any) {
      showError("Erro ao processar ação: " + err.message);
    }
  };

  if (!uniqueId) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
        <h1 className="text-2xl font-bold text-foreground">Link Inválido</h1>
        <p className="text-muted-foreground">O link da proposta é inválido.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
        <h1 className="text-2xl font-bold text-foreground">Proposta Não Encontrada</h1>
        <p className="text-muted-foreground">A proposta não foi encontrada ou o link é inválido.</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="bg-card border border-border rounded-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-foreground">Página de Aprovação Pública</CardTitle>
            <CardDescription className="text-muted-foreground">
              Aprove ou solicite edições para as tarefas abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.isExpired ? (
              <div className="text-center p-8 bg-red-100 border border-red-200 rounded-lg">
                <AlertCircle className="h-10 w-10 text-red-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-red-800">Link Expirado</h2>
                <p className="text-red-700 mt-2">Este link de aprovação expirou.</p>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-semibold text-foreground">Tarefas para Aprovação</h3>
                {data.tasks.map(task => (
                  <div key={task.id} className="p-4 border border-border rounded-lg bg-muted/20">
                    <h4 className="font-semibold text-foreground">{task.title}</h4>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button onClick={() => handleAction('approved')} className="bg-green-600 text-white hover:bg-green-700">
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
                      </Button>
                      <Button variant="outline" onClick={() => { setActionType('edit'); setIsActionModalOpen(true); }} className="text-yellow-600 hover:bg-yellow-600/10">
                        <Edit className="mr-2 h-4 w-4" /> Solicitar Edição
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal para solicitar edição ou rejeitar */}
      <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {actionType === 'edit' ? "Solicitar Edição" : "Rejeitar Proposta"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {actionType === 'edit' ? "Descreva as alterações que você gostaria de solicitar." : "Por favor, forneça um breve motivo para a rejeição."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder={actionType === 'edit' ? "Ex: Gostaria de reduzir a quantidade de posts para 10." : "Ex: Orçamento acima do esperado."}
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              className="bg-input border-border text-foreground focus-visible:ring-ring"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsActionModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => handleAction(actionType === 'edit' ? 'edit_requested' : 'rejected')} 
                className={cn(actionType === 'edit' ? "bg-yellow-600 text-white hover:bg-yellow-700" : "bg-red-600 text-white hover:bg-red-700")} 
                disabled={!editReason}
              >
                {actionType === 'edit' ? "Solicitar Edição" : "Confirmar Rejeição"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicApprovalPage;