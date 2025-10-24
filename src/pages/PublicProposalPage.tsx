"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Edit, FileText, Clock, Users, DollarSign } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { format, addDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';
import { Proposal, ProposalItem, PROPOSAL_STATUS_LABELS } from '@/types/proposal';
import { Separator } from '@/components/ui/separator';

type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'expired' | 'rejected' | 'edit_requested';

const fetchProposalByUniqueId = async (uniqueId: string): Promise<Proposal | null> => {
  // Fetch proposal and its items
  const { data, error } = await supabase
    .from("proposals")
    .select(`
      *,
      items:proposal_items(*)
    `)
    .eq("unique_link_id", uniqueId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  
  const proposal = data as Proposal | null;

  if (proposal && proposal.status === 'sent' && !proposal.viewed_at) {
    // Mark as viewed if it's the first time viewing and status is 'sent'
    await supabase
      .from("proposals")
      .update({ viewed_at: new Date().toISOString(), status: 'viewed' })
      .eq("id", proposal.id);
    
    // Note: We don't refetch immediately, relying on the next query or refresh.
    proposal.status = 'viewed';
    proposal.viewed_at = new Date().toISOString();
  }

  return proposal;
};

const ProposalViewerPage: React.FC = () => {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const navigate = useNavigate();
  const [editReason, setEditReason] = useState('');
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'reject' | 'edit' | null>(null);

  const { data: proposal, isLoading, error, refetch } = useQuery<Proposal | null, Error>({
    queryKey: ["publicProposal", uniqueId],
    queryFn: () => fetchProposalByUniqueId(uniqueId!),
    enabled: !!uniqueId,
  });

  const totalAmount = proposal?.items?.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) || 0;
  const expirationDate = proposal?.created_at ? addDays(new Date(proposal.created_at), proposal.validity_days) : null;
  const isExpired = expirationDate ? isPast(expirationDate) && proposal?.status !== 'accepted' && proposal?.status !== 'rejected' : false;
  const isFinalized = proposal?.status === 'accepted' || proposal?.status === 'rejected' || isExpired;

  const handleAction = async (newStatus: 'accepted' | 'rejected' | 'edit_requested') => {
    if (!proposal || !proposal.user_id) {
      showError("Dados da proposta incompletos.");
      return;
    }
    
    if (isFinalized && newStatus !== 'edit_requested') {
        showError("Esta proposta já foi finalizada.");
        return;
    }

    const reason = (newStatus === 'rejected' || newStatus === 'edit_requested') ? editReason : null;
    
    if ((newStatus === 'rejected' || newStatus === 'edit_requested') && !reason) {
        showError("Por favor, forneça um motivo para a rejeição ou solicitação de edição.");
        return;
    }

    try {
      // Chamada para a Edge Function para atualizar o status e notificar
      const { error: fnError } = await supabase.functions.invoke('handle-proposal-action', {
        body: {
          proposalId: proposal.id,
          status: newStatus,
          userId: proposal.user_id,
          totalAmount: totalAmount,
          clientName: proposal.client_name,
          editReason: reason,
        },
      });

      if (fnError) {
        console.error("Erro ao atualizar status da proposta via Edge Function:", fnError);
        showError("Erro ao processar ação. Tente novamente.");
        return;
      }
      
      // Atualiza o status localmente para feedback imediato
      await supabase
        .from("proposals")
        .update({ 
            status: newStatus, 
            accepted_at: newStatus === 'accepted' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString() 
        })
        .eq("id", proposal.id);

      showSuccess(`Proposta ${newStatus === 'accepted' ? 'Aceita' : newStatus === 'rejected' ? 'Rejeitada' : 'Edição Solicitada'} com sucesso!`);
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

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
        <h1 className="text-2xl font-bold text-foreground">Proposta Não Encontrada</h1>
        <p className="text-muted-foreground">A proposta não foi encontrada ou o link é inválido.</p>
      </div>
    );
  }
  
  const statusLabel = PROPOSAL_STATUS_LABELS[proposal.status as keyof typeof PROPOSAL_STATUS_LABELS] || 'Desconhecido';

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header e Status */}
        <Card className="bg-card border border-border rounded-xl shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                <div>
                  <CardTitle className="text-2xl font-bold text-foreground">{proposal.title}</CardTitle>
                  <CardDescription className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-4 w-4" /> {proposal.client_name} ({proposal.client_company || 'N/A'})
                  </CardDescription>
                </div>
              </div>
              <div className="text-right">
                <p className={cn("text-lg font-semibold", isFinalized ? 'text-muted-foreground' : 'text-primary')}>
                    Status: {statusLabel}
                </p>
                {isExpired && <p className="text-sm text-red-500 font-medium">EXPIRADA</p>}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Ações do Cliente */}
        <Card className="bg-card border border-border rounded-xl shadow-lg">
            <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {expirationDate && (
                        <p>Válido até: {format(expirationDate, "PPP", { locale: ptBR })} ({proposal.validity_days} dias)</p>
                    )}
                </div>
                
                <div className="flex justify-end gap-3 w-full sm:w-auto">
                    {isFinalized ? (
                        <Button variant="outline" disabled className="w-full sm:w-auto">
                            Proposta Finalizada
                        </Button>
                    ) : (
                        <>
                            <Button 
                                onClick={() => { setActionType('edit'); setIsActionModalOpen(true); }} 
                                variant="outline" 
                                className="w-full sm:w-auto border-yellow-600 text-yellow-600 hover:bg-yellow-600/10"
                            >
                                <Edit className="mr-2 h-4 w-4" /> Solicitar Edição
                            </Button>
                            <Button 
                                onClick={() => handleAction('accepted')} 
                                className="w-full sm:w-auto bg-green-600 text-white hover:bg-green-700"
                            >
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Aceitar Proposta
                            </Button>
                            <Button 
                                onClick={() => { setActionType('reject'); setIsActionModalOpen(true); }} 
                                variant="destructive" 
                                className="w-full sm:w-auto"
                            >
                                <XCircle className="mr-2 h-4 w-4" /> Rejeitar
                            </Button>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>

        {/* Detalhes do Orçamento */}
        <Card className="bg-card border border-border rounded-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground">Itens do Orçamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {proposal.items && proposal.items.length > 0 ? (
              proposal.items.sort((a, b) => a.order_index - b.order_index).map(item => (
                <div key={item.id} className="p-3 border border-border rounded-lg bg-muted/20">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold text-foreground">{item.name}</h4>
                    <p className="font-bold text-primary">{formatCurrency(item.quantity * item.unit_price)}</p>
                  </div>
                  {item.description && <p className="text-sm text-muted-foreground mt-1">{item.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.quantity} x {formatCurrency(item.unit_price)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Nenhum item listado.</p>
            )}
            <Separator />
            <div className="flex justify-between items-center pt-2">
              <p className="text-xl font-bold text-foreground">Total:</p>
              <p className="text-3xl font-extrabold text-primary">{formatCurrency(totalAmount)}</p>
            </div>
          </CardContent>
        </Card>
        
        {/* Condições e Termos */}
        <Card className="bg-card border border-border rounded-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground">Condições e Termos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-1">Condições de Pagamento:</h4>
              <p>{proposal.payment_conditions || 'Não especificado.'}</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Termos Personalizados:</h4>
              <p>{proposal.custom_terms || 'Não há termos personalizados definidos.'}</p>
            </div>
          </CardContent>
        </Card>
        
        {/* Status Final */}
        {isFinalized && (
            <Card className={cn("bg-card border rounded-xl shadow-lg", proposal.status === 'accepted' ? 'border-green-500' : 'border-red-500')}>
                <CardContent className="p-4 text-center">
                    <p className={cn("text-xl font-bold", proposal.status === 'accepted' ? 'text-green-500' : 'text-red-500')}>
                        {proposal.status === 'accepted' ? 'PROPOSTA ACEITA!' : proposal.status === 'rejected' ? 'PROPOSTA REJEITADA.' : 'PROPOSTA EXPIRADA.'}
                    </p>
                    {proposal.accepted_at && <p className="text-sm text-muted-foreground mt-1">Aceita em: {formatDateTime(proposal.accepted_at)}</p>}
                </CardContent>
            </Card>
        )}
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

export default ProposalViewerPage;