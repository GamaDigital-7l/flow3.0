import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Proposal, ProposalStatus, PROPOSAL_STATUS_LABELS } from '@/types/proposal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2, FileText, Send, Eye, CheckCircle2, XCircle, Clock, Copy } from 'lucide-react';
import { showError, showSuccess, showInfo } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import ProposalForm from '@/components/proposal/ProposalForm';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatCurrency } from '@/lib/utils';
import { format, addDays, isPast } from 'date-fns';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const fetchProposals = async (userId: string): Promise<Proposal[]> => {
  const { data, error } = await supabase
    .from("proposals")
    .select(`
      *,
      client:clients(id, name)
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

const getStatusBadge = (status: ProposalStatus, validityDays: number, createdAt: string) => {
  const expirationDate = addDays(new Date(createdAt), validityDays);
  const isExpired = isPast(expirationDate) && status !== 'accepted' && status !== 'rejected';

  if (isExpired) {
    return <Badge variant="destructive" className="bg-red-500/20 text-red-500">Expirado</Badge>;
  }

  switch (status) {
    case 'draft':
      return <Badge variant="secondary" className="bg-muted/50 text-muted-foreground">Rascunho</Badge>;
    case 'sent':
      return <Badge className="bg-blue-500/20 text-blue-500">Enviado</Badge>;
    case 'viewed':
      return <Badge className="bg-yellow-500/20 text-yellow-500">Visualizado</Badge>;
    case 'accepted':
      return <Badge className="bg-green-500/20 text-green-500">Aceito</Badge>;
    case 'rejected':
      return <Badge variant="destructive">Rejeitado</Badge>;
    default:
      return <Badge variant="secondary">{PROPOSAL_STATUS_LABELS[status]}</Badge>;
  }
};

const Proposals: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const { data: proposals, isLoading, error, refetch } = useQuery<Proposal[], Error>({
    queryKey: ["proposals", userId],
    queryFn: () => fetchProposals(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Proposal | undefined>(undefined);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [currentProposalLink, setCurrentProposalLink] = useState<{ link: string; clientName: string } | null>(null);

  const handleProposalSaved = () => {
    refetch();
    setIsFormOpen(false);
    setEditingProposal(undefined);
  };

  const handleEditProposal = (proposal: Proposal) => {
    setEditingProposal(proposal);
    setIsFormOpen(true);
  };

  const handleDeleteProposal = useMutation({
    mutationFn: async (proposalId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("proposals")
        .delete()
        .eq("id", proposalId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Proposta deletada com sucesso!");
      refetch();
    },
    onError: (err: any) => {
      showError("Erro ao deletar proposta: " + err.message);
    },
  });
  
  const handleGenerateLink = (proposal: Proposal) => {
    if (!proposal.unique_link_id) {
      showError("Erro: Proposta não possui um ID de link único.");
      return;
    }
    
    // Assumindo que a URL base é a raiz do seu app
    const publicLink = `${window.location.origin}/proposal/${proposal.unique_link_id}`;
    
    // Atualiza o status para 'sent' se for 'draft'
    if (proposal.status === 'draft') {
      supabase.from('proposals').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', proposal.id).then(({ error }) => {
        if (error) console.error("Erro ao atualizar status para 'sent':", error);
        else refetch();
      });
    }

    setCurrentProposalLink({ link: publicLink, clientName: proposal.client_name });
    setIsLinkModalOpen(true);
  };

  const handleCopyLink = (link: string, message: boolean) => {
    const whatsappMessage = `Olá ${currentProposalLink?.clientName || 'cliente'}! Tenho o prazer de apresentar a proposta de orçamento da Gama Flow. Você pode visualizá-la aqui: ${link}`;
    const textToCopy = message ? whatsappMessage : link;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      showSuccess(message ? "Mensagem e link copiados para o WhatsApp!" : "Link copiado!");
    }).catch(err => {
      showError("Erro ao copiar: " + err);
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando propostas...
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar propostas: " + error.message);
    return <p className="text-red-500">Erro ao carregar propostas.</p>;
  }

  return (
    <div className="page-content-wrapper space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-7 w-7 text-primary" /> Orçamentos Profissionais
        </h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingProposal(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Nova Proposta
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingProposal ? "Editar Proposta" : "Criar Nova Proposta"}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingProposal ? "Atualize os detalhes do orçamento." : "Crie um orçamento profissional para enviar ao seu cliente."}
              </DialogDescription>
            </DialogHeader>
            <ProposalForm
              initialData={editingProposal}
              onProposalSaved={handleProposalSaved}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground mb-8">
        Crie, envie e rastreie o status dos seus orçamentos.
      </p>

      <div className="space-y-4">
        {proposals && proposals.length > 0 ? (
          proposals.map(proposal => (
            <Card key={proposal.id} className="bg-card border border-border rounded-xl shadow-sm card-hover-effect">
              <CardContent className="p-4 flex justify-between items-center gap-4 flex-wrap">
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="font-bold text-lg text-foreground truncate">{proposal.title}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> {proposal.client_name} ({proposal.client_company || 'N/A'})
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(proposal.status, proposal.validity_days, proposal.created_at)}
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Validade: {proposal.validity_days} dias
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 flex-shrink-0">
                  {proposal.unique_link_id && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleGenerateLink(proposal)}
                      className="text-blue-500 hover:bg-blue-500/10"
                    >
                      <Send className="mr-2 h-4 w-4" /> Enviar Link
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => handleEditProposal(proposal)} className="h-8 w-8 text-blue-500 hover:bg-blue-500/10">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteProposal.mutate(proposal.id)} className="h-8 w-8 text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-muted-foreground">Nenhuma proposta encontrada. Crie sua primeira proposta!</p>
        )}
      </div>
      
      {/* Modal de Link de Envio */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Link de Proposta Enviado</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Use os botões abaixo para enviar o link para {currentProposalLink?.clientName}.
            </DialogDescription>
          </DialogHeader>
          {currentProposalLink && (
            <div className="space-y-4">
              <div className="p-3 bg-secondary rounded-lg break-all text-sm text-foreground border border-border">
                {currentProposalLink.link}
              </div>
              <Button 
                onClick={() => handleCopyLink(currentProposalLink.link, true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <Copy className="mr-2 h-4 w-4" /> Copiar Mensagem + Link (WhatsApp)
              </Button>
              <Button 
                onClick={() => handleCopyLink(currentProposalLink.link, false)}
                variant="outline"
                className="w-full border-border text-foreground hover:bg-accent"
              >
                <Copy className="mr-2 h-4 w-4" /> Copiar Apenas Link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Proposals;