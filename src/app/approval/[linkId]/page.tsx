"use client";

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ThumbsUp, MessageSquare, CheckCircle, Clock, AlertTriangle, Info, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { showError, showSuccess } from '@/utils/toast';
import { getInitials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
    .eq('id', linkId)
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

// Componente para uma única tarefa
const ApprovalTaskCard = ({ task, onApprove, onEditRequest, isProcessing, onImageClick }: {
  task: ClientTask;
  onApprove: (taskId: string) => void;
  onEditRequest: (taskId: string, reason: string) => void;
  isProcessing: boolean;
  onImageClick: (url: string) => void;
}) => {
  const [editReason, setEditReason] = useState(task.edit_reason || '');
  const [showEditForm, setShowEditForm] = useState(task.status === 'edit_requested');

  const handleEditRequest = () => {
    if (!editReason.trim()) {
      showError('Por favor, descreva a alteração necessária.');
      return;
    }
    onEditRequest(task.id, editReason);
  };

  return (
    <Card className="w-full overflow-hidden shadow-lg bg-card border-border transition-all duration-300">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">{task.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {task.image_urls && task.image_urls.length > 0 && (
          <div className="grid grid-cols-1 gap-2">
            {task.image_urls.map((url, index) => (
              <button key={index} onClick={() => onImageClick(url)} className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg">
                <img
                  src={url}
                  alt={`Imagem ${index + 1} de ${task.title}`}
                  className="rounded-lg object-cover w-full h-auto cursor-pointer"
                />
              </button>
            ))}
          </div>
        )}
        {task.description && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start space-y-4 bg-muted/50 p-4">
        {task.status === 'under_review' && !showEditForm && (
          <div className="flex w-full gap-2">
            <Button onClick={() => onApprove(task.id)} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-700 text-white">
              <ThumbsUp className="mr-2 h-4 w-4" /> Aprovar
            </Button>
            <Button variant="outline" onClick={() => setShowEditForm(true)} disabled={isProcessing} className="w-full">
              <MessageSquare className="mr-2 h-4 w-4" /> Solicitar Edição
            </Button>
          </div>
        )}
        {showEditForm && (
          <div className="w-full space-y-2">
            <Textarea
              placeholder="Descreva as alterações necessárias..."
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              className="bg-background"
            />
            <div className="flex w-full gap-2">
              <Button onClick={handleEditRequest} disabled={isProcessing} className="w-full bg-primary text-primary-foreground">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Enviar Solicitação'}
              </Button>
              {task.status === 'under_review' && (
                 <Button variant="ghost" onClick={() => setShowEditForm(false)} disabled={isProcessing}>Cancelar</Button>
              )}
            </div>
          </div>
        )}
        {task.status === 'edit_requested' && !showEditForm && (
          <div className="w-full p-3 rounded-md bg-yellow-100 border border-yellow-200 text-yellow-800 text-sm">
            <p className="font-semibold">Edição solicitada:</p>
            <p className="whitespace-pre-wrap mt-1">{task.edit_reason}</p>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

// Componente principal da página
const ApprovalPageContent = () => {
  const params = useParams();
  const linkId = params.linkId as string;
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['approvalLink', linkId],
    queryFn: () => loadData(linkId),
    enabled: !!linkId,
    staleTime: Infinity, // Os dados são estáticos para este link, a menos que recarregados
    retry: false,
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status, reason }: { taskId: string; status: ClientTaskStatus; reason?: string }) => {
      const { error } = await supabase
        .from('client_tasks')
        .update({
          status: status,
          edit_reason: reason || null,
        })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      showSuccess(variables.status === 'approved' ? 'Tarefa aprovada com sucesso!' : 'Solicitação de edição enviada!');
      refetch();
    },
    onError: (err: any) => {
      showError('Ocorreu um erro: ' + err.message);
    },
  });

  const handleApprove = (taskId: string) => {
    updateTaskStatus.mutate({ taskId, status: 'approved' });
  };

  const handleEditRequest = (taskId: string, reason: string) => {
    updateTaskStatus.mutate({ taskId, status: 'edit_requested', reason });
  };

  const approvedTasks = useMemo(() => data?.tasks.filter(t => t.status === 'approved') || [], [data]);
  const pendingTasks = useMemo(() => data?.tasks.filter(t => t.status !== 'approved') || [], [data]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/40">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4 text-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center justify-center text-destructive">
              <AlertTriangle className="mr-2 h-6 w-6" /> Erro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Não foi possível carregar a página de aprovação. O link pode ser inválido ou um erro ocorreu.</p>
            <p className="mt-2 text-sm text-muted-foreground">{(error as Error)?.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (data.isExpired) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4 text-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center justify-center text-destructive">
              <Clock className="mr-2 h-6 w-6" /> Link Expirado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Este link de aprovação era válido por 7 dias e já expirou.</p>
            <p className="mt-2 text-sm text-muted-foreground">Por favor, solicite um novo link ao responsável.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-muted/40">
      {/* Container principal com layout corrigido */}
      <main className="w-full max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center mb-8">
          <Avatar className="h-16 w-16 mb-4">
            <AvatarImage src={data.clientLogoUrl || undefined} alt={data.clientName} />
            <AvatarFallback className="text-xl bg-primary/20 text-primary">{getInitials(data.clientName)}</AvatarFallback>
          </Avatar>
          <h1 className="text-3xl font-bold text-foreground">Aprovação de Conteúdo</h1>
          <p className="text-lg text-muted-foreground">Cliente: {data.clientName}</p>
          {data.expirationDate && (
            <div className="mt-4 text-sm text-muted-foreground bg-background border border-border rounded-full px-4 py-1.5 flex items-center gap-2">
              <Info className="h-4 w-4" />
              <span>Este link de aprovação expira em {data.expirationDate}</span>
            </div>
          )}
        </div>

        {pendingTasks.length === 0 && approvedTasks.length > 0 && (
          <div className="text-center p-8 bg-green-100 border border-green-200 rounded-lg">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-green-800">Tudo aprovado!</h2>
            <p className="text-green-700 mt-2">Obrigado! Todas as tarefas foram aprovadas.</p>
          </div>
        )}

        {pendingTasks.length > 0 && (
          <>
            <h2 className="text-xl font-semibold mb-4 text-foreground">Itens Pendentes de Aprovação</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingTasks.map(task => (
                <ApprovalTaskCard
                  key={task.id}
                  task={task}
                  onApprove={handleApprove}
                  onEditRequest={handleEditRequest}
                  isProcessing={updateTaskStatus.isPending}
                  onImageClick={setLightboxUrl}
                />
              ))}
            </div>
          </>
        )}

        {approvedTasks.length > 0 && (
          <>
            <h2 className="text-xl font-semibold mt-12 mb-4 text-foreground">Itens Já Aprovados</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-70">
              {approvedTasks.map(task => (
                <Card key={task.id} className="w-full overflow-hidden shadow-md bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-foreground">{task.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {task.image_urls && task.image_urls.length > 0 && (
                      <img
                        src={task.image_urls[0]}
                        alt={`Imagem de ${task.title}`}
                        className="rounded-md object-cover w-full h-auto"
                      />
                    )}
                  </CardContent>
                  <CardFooter className="bg-green-100 p-3">
                    <div className="flex items-center text-green-700">
                      <CheckCircle className="mr-2 h-5 w-5" />
                      <span className="font-medium text-sm">Aprovado</span>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
      
      {/* Lightbox para Imagem */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="lightbox-fullscreen-override">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLightboxUrl(null)} 
            className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 h-10 w-10"
          >
            <XCircle className="h-6 w-6" />
          </Button>
          {lightboxUrl && (
            <img
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

export default ApprovalPageContent;