"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
// import { ClientTask, PublicApprovalLink, ClientTaskStatus } from '@/types/client'; // Removido
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Edit, ArrowLeft, Send } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { cn } from '@/lib/utils';

// Tipos simplificados para evitar dependência de '@/types/client'
interface PublicApprovalLink {
  id: string;
  unique_id: string;
  client_id: string;
  user_id: string;
  month_year_reference: string;
  expires_at: string;
  is_active: boolean;
}

interface ClientTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  time: string | null;
  image_urls: string[] | null;
  public_approval_enabled: boolean;
  edit_reason: string | null;
  is_selected: boolean;
}

const fetchApprovalData = async (uniqueId: string): Promise<PublicApprovalLink | null> => {
  return null;
};

const PublicApprovalPage: React.FC = () => {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const navigate = useNavigate();
  const [editReason, setEditReason] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { data: approvalLink, isLoading, error } = useQuery<PublicApprovalLink | null, Error>({
    queryKey: ["approvalLink", uniqueId],
    queryFn: () => fetchApprovalData(uniqueId!),
    enabled: !!uniqueId,
  });

  const handleAction = async (newStatus: 'accepted' | 'rejected' | 'edit_requested') => {
    if (!uniqueId) {
      showError("Link inválido.");
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('update-client-task-status-public', {
        body: {
          uniqueId: uniqueId,
          taskId: '123', // Substituir pelo ID da tarefa real
          newStatus: newStatus,
          editReason: newStatus === 'edit_requested' ? editReason : null,
        },
      });

      if (error) {
        console.error("Erro ao atualizar status da tarefa:", error);
        showError("Erro ao atualizar status da tarefa: " + error.message);
        return;
      }

      showSuccess(`Tarefa ${newStatus === 'accepted' ? 'aprovada' : newStatus === 'rejected' ? 'rejeitada' : 'edição solicitada'} com sucesso!`);
      navigate('/login');
    } catch (err: any) {
      showError("Erro ao atualizar status da tarefa: " + err.message);
    }
  };

  if (!uniqueId) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
        <h1 className="text-2xl font-bold text-foreground">Link Inválido</h1>
        <p className="text-muted-foreground">O link de aprovação é inválido.</p>
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

  if (error || !approvalLink) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
        <h1 className="text-2xl font-bold text-foreground">Link de Aprovação Não Encontrado</h1>
        <p className="text-muted-foreground">O link de aprovação não foi encontrado ou é inválido.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8 p-4 bg-card rounded-xl shadow-lg border border-border">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Página de Aprovação Pública</h1>
            <p className="text-muted-foreground">
              Aprove ou solicite edição para a tarefa.
            </p>
          </div>
        </div>

        <Card className="mb-4 bg-card border border-border rounded-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground">Detalhes da Tarefa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p><strong>Título:</strong> Tarefa de Exemplo</p>
            <p><strong>Descrição:</strong> Detalhes da tarefa aqui...</p>
            <p><strong>Data de Vencimento:</strong> 20/08/2024</p>
            {/* Adicione mais detalhes da tarefa aqui */}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button onClick={() => setIsEditModalOpen(true)} className="bg-yellow-600 text-white hover:bg-yellow-700">
            <Edit className="mr-2 h-4 w-4" /> Solicitar Edição
          </Button>
          <Button onClick={() => handleAction('approved')} className="bg-green-600 text-white hover:bg-green-700">
            <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
          </Button>
          <Button onClick={() => handleAction('rejected')} className="bg-red-600 text-white hover:bg-red-700">
            <XCircle className="mr-2 h-4 w-4" /> Rejeitar
          </Button>
        </div>
      </div>

      {/* Modal para solicitar edição */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Solicitar Edição</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Descreva as alterações que você gostaria de solicitar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Descreva as alterações que você gostaria de solicitar..."
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              className="bg-input border-border text-foreground focus-visible:ring-ring"
            />
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => {
                handleAction('edit_requested');
                setIsEditModalOpen(false);
              }} className="bg-yellow-600 text-white hover:bg-yellow-700" disabled={!editReason}>
                Solicitar Edição
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicProposalPage;