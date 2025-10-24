"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Proposal, ProposalItem, PROPOSAL_STATUS_LABELS } from '@/types/proposal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Edit, ArrowLeft, Send } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';

const fetchProposalByUniqueId = async (uniqueId: string): Promise<Proposal | null> => {
  const { data, error } = await supabase
    .from("proposals")
    .select(`
      *,
      client:clients(id, name),
      items:proposal_items(*)
    `)
    .eq("unique_link_id", uniqueId)
    .single();

  if (error) {
    throw error;
  }
  return data as Proposal || null;
};

const PublicProposalPage: React.FC = () => {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const navigate = useNavigate();
  const [editReason, setEditReason] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { data: proposal, isLoading, error } = useQuery<Proposal | null, Error>({
    queryKey: ["publicProposal", uniqueId],
    queryFn: () => fetchProposalByUniqueId(uniqueId!),
    enabled: !!uniqueId,
  });

  const handleAction = async (newStatus: 'accepted' | 'rejected' | 'edit_requested') => {
    try {
      const { error } = await supabase.functions.invoke('handle-proposal-action', {
        body: {
          proposalId: proposal.id,
          status: newStatus,
          userId: proposal.user_id,
          totalAmount: proposal.items?.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) || 0,
          clientName: proposal.client_name,
          editReason: newStatus === 'edit_requested' ? editReason : null,
        },
      });

      if (error) {
        console.error("Erro ao atualizar status da proposta:", error);
        showError("Erro ao atualizar status da proposta: " + error.message);
        return;
      }

      showSuccess(`Proposta ${newStatus === 'accepted' ? 'aceita' : newStatus === 'rejected' ? 'rejeitada' : 'edição solicitada'} com sucesso!`);
      navigate('/login');
    } catch (err: any) {
      showError("Erro ao atualizar status da proposta: " + err.message);
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

  const totalAmount = proposal.items?.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) || 0;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8 p-4 bg-card rounded-xl shadow-lg border border-border">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{proposal.title}</h1>
            <p className="text-muted-foreground">
              Proposta para {proposal.client_name} ({proposal.client_company || 'N/A'})
            </p>
          </div>
        </div>

        <Card className="mb-4 bg-card border border-border rounded-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground">Detalhes da Proposta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p><strong>Valor Total:</strong> {formatCurrency(totalAmount)}</p>
            <p><strong>Condições de Pagamento:</strong> {proposal.payment_conditions}</p>
            <p><strong>Validade:</strong> {format(new Date(proposal.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
            {proposal.items && proposal.items.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-foreground">Itens da Proposta</h3>
                <ul className="list-disc list-inside">
                  {proposal.items.map(item => (
                    <li key={item.id}>
                      {item.name} - {item.description} ({item.quantity} x {formatCurrency(item.unit_price)})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {proposal.custom_terms && (
              <div>
                <h3 className="text-lg font-semibold text-foreground">Termos e Condições</h3>
                <p>{proposal.custom_terms}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button onClick={() => setIsEditModalOpen(true)} className="bg-yellow-600 text-white hover:bg-yellow-700">
            <Edit className="mr-2 h-4 w-4" /> Solicitar Edição
          </Button>
          <Button onClick={() => handleAction('accepted')} className="bg-green-600 text-white hover:bg-green-700">
            <CheckCircle2 className="mr-2 h-4 w-4" /> Aceitar Proposta
          </Button>
          <Button onClick={() => handleAction('rejected')} className="bg-red-600 text-white hover:bg-red-700">
            <XCircle className="mr-2 h-4 w-4" /> Rejeitar Proposta
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