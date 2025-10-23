"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Proposal, ProposalItem, PROPOSAL_STATUS_LABELS } from '@/types/proposal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Clock, FileText, Users, DollarSign, Download, MessageSquare, ArrowLeft, Zap, Shield, Heart } from 'lucide-react';
import { showError, showSuccess, showInfo } from '@/utils/toast';
import { format, addDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { cn, formatCurrency } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';

// --- Mock Data para Conteúdo Estático da Gama Flow ---
const GAMA_FLOW_INFO = {
  logoUrl: "/favicon.svg", // Usando o favicon como logo
  companyName: "Gama Flow Studio",
  tagline: "Design e Estratégia para o seu Próximo Nível.",
  presentation: [
    { icon: Zap, title: "Foco em Resultados", description: "Não entregamos apenas design, entregamos soluções que geram crescimento e impacto real no seu negócio." },
    { icon: Shield, title: "Transparência Total", description: "Processos claros, comunicação aberta e sem surpresas. Você acompanha cada etapa do projeto." },
    { icon: Heart, title: "Design Acolhedor", description: "Criamos identidades visuais que conectam emocionalmente com seu público, usando uma estética minimalista e elegante." },
  ],
  portfolio: [
    { title: "Projeto Alpha - Branding", description: "Criação de identidade visual completa para startup de tecnologia.", imageUrl: "/placeholder.svg", link: "#" },
    { title: "Campanha Beta - Social Media", description: "Estratégia e execução de campanha de lançamento com 200% de ROI.", imageUrl: "/placeholder.svg", link: "#" },
  ]
};
// --- Fim Mock Data ---

interface ProposalData extends Proposal {
  items: ProposalItem[];
}

const fetchProposalData = async (uniqueId: string): Promise<ProposalData | null> => {
  // 1. Buscar a proposta e os itens
  const { data: proposal, error } = await supabase
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
  
  if (!proposal) return null;

  // 2. Rastrear visualização (se o status for 'sent' ou 'draft')
  if (proposal.status === 'sent' || proposal.status === 'draft') {
    await supabase
      .from("proposals")
      .update({ status: 'viewed', viewed_at: new Date().toISOString() })
      .eq("id", proposal.id);
    
    // Nota: A notificação de visualização via Telegram deve ser implementada via DB trigger ou outra Edge Function,
    // mas por enquanto, a atualização do status 'viewed' é suficiente.
  }

  return proposal as ProposalData;
};

const PublicProposalPage: React.FC = () => {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const navigate = useNavigate();
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false); // Estado para controlar o modal

  const { data: proposal, isLoading, error, refetch } = useQuery<ProposalData | null, Error>({
    queryKey: ["publicProposal", uniqueId],
    queryFn: () => fetchProposalData(uniqueId!),
    enabled: !!uniqueId,
    staleTime: Infinity, // Não refetch automaticamente
  });

  const totalAmount = useMemo(() => {
    return proposal?.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) || 0;
  }, [proposal]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, reason }: { status: ProposalStatus, reason?: string }) => {
      if (!proposal) throw new Error("Proposta não encontrada.");
      
      const updateData: Partial<Proposal> = {
        status: status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'accepted') {
        updateData.accepted_at = new Date().toISOString();
      }
      if (status === 'rejected') {
        updateData.custom_terms = reason ? `Rejeitado: ${reason}` : 'Rejeitado pelo cliente.';
      }

      // 1. Atualizar status no DB
      const { error: dbUpdateError } = await supabase
        .from("proposals")
        .update(updateData)
        .eq("id", proposal.id);

      if (dbUpdateError) throw dbUpdateError;
      
      // 2. Chamar Edge Function para integrações (Telegram/Financeiro)
      const edgeFunctionUrl = "https://hfbxokphlwojrsrqqxba.supabase.co/functions/v1/handle-proposal-action";
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Não precisa de Authorization header, pois a Edge Function usa Service Role Key
        },
        body: JSON.stringify({
          proposalId: proposal.id,
          status: status,
          userId: proposal.user_id,
          totalAmount: totalAmount,
          clientName: proposal.client_name,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        console.error("Edge Function Error:", errorBody);
        showInfo("Status atualizado, mas a notificação/integração financeira falhou. Verifique o log.");
      }

      return status;
    },
    onSuccess: (newStatus) => {
      showSuccess(`Proposta ${newStatus === 'accepted' ? 'Aceita' : 'Rejeitada'} com sucesso!`);
      refetch(); // Atualiza o status na tela
      setIsRejectionModalOpen(false);
      if (newStatus === 'accepted') {
        setShowWhatsAppModal(true); // Abre o modal de WhatsApp
      }
    },
    onError: (err: any) => {
      showError("Erro ao atualizar status: " + err.message);
    },
  });

  const handleAccept = () => {
    if (window.confirm("Tem certeza que deseja ACEITAR esta proposta?")) {
      updateStatusMutation.mutate({ status: 'accepted' });
    }
  };

  const handleReject = () => {
    setIsRejectionModalOpen(true);
  };

  const handleConfirmReject = () => {
    updateStatusMutation.mutate({ status: 'rejected', reason: rejectionReason });
  };

  const handleDownloadPdf = () => {
    showInfo("Funcionalidade de Download PDF em desenvolvimento.", { duration: 3000 });
    // TODO: Implementar exportação para PDF (Etapa 8)
  };

  const handleWhatsApp = () => {
    if (!proposal) return;
    const link = `${window.location.origin}/proposal/${proposal.unique_link_id}`;
    const message = `Olá! Gostei da proposta e quero seguir com o projeto ${proposal.title}. Você pode visualizá-la aqui: ${link}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    setShowWhatsAppModal(false); // Fecha o modal após abrir o WhatsApp
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="text-2xl font-bold ml-4">Carregando Proposta...</h1>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
        <XCircle className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-3xl font-bold mb-2">Proposta Não Encontrada ou Expirada</h1>
        <p className="text-lg text-muted-foreground text-center">Verifique o link ou entre em contato com a Gama Flow Studio.</p>
        <Button onClick={() => navigate('/')} variant="link" className="mt-4 text-primary">Voltar para o Início</Button>
      </div>
    );
  }

  const expirationDate = addDays(new Date(proposal.created_at), proposal.validity_days);
  const isExpired = isPast(expirationDate) && proposal.status !== 'accepted' && proposal.status !== 'rejected';
  const isFinalized = proposal.status === 'accepted' || proposal.status === 'rejected' || isExpired;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header Fixo e Elegante */}
      <header className="sticky top-0 z-30 w-full border-b border-border bg-card shadow-md pt-[var(--sat)]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src={GAMA_FLOW_INFO.logoUrl} alt="Gama Flow Logo" className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold text-primary">{GAMA_FLOW_INFO.companyName}</span>
          </div>
          <Badge className={cn(
            "text-sm font-semibold",
            isExpired ? "bg-red-500/20 text-red-500" :
            proposal.status === 'accepted' ? "bg-green-500/20 text-green-500" :
            proposal.status === 'rejected' ? "bg-red-500/20 text-red-500" :
            "bg-blue-500/20 text-blue-500"
          )}>
            {isExpired ? 'EXPIRADO' : PROPOSAL_STATUS_LABELS[proposal.status]}
          </Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-10">
        
        {/* Seção de Boas-Vindas e Título */}
        <section className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">{proposal.title}</h1>
          <p className="text-xl text-muted-foreground">Proposta para {proposal.client_name} ({proposal.client_company || 'Cliente Individual'})</p>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            <Clock className="h-4 w-4" /> Válida até: {format(expirationDate, 'PPP', { locale: ptBR })}
          </p>
        </section>

        {/* Apresentação da Empresa */}
        <Card className="bg-card border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-primary">Nossa Proposta de Valor</CardTitle>
            <CardDescription className="text-muted-foreground">{GAMA_FLOW_INFO.tagline}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {GAMA_FLOW_INFO.presentation.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={index} className="text-center space-y-2 p-4 rounded-lg bg-secondary/50 border border-border">
                  <Icon className="h-8 w-8 text-primary mx-auto" />
                  <h3 className="font-semibold text-lg text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Detalhes do Orçamento */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" /> Detalhes do Investimento
          </h2>
          
          {/* Lista de Itens */}
          <div className="space-y-4">
            {proposal.items.map((item, index) => (
              <div key={item.id} className="p-4 bg-card border border-border rounded-lg shadow-sm">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-lg text-foreground">{item.name}</h3>
                  <p className="text-lg font-bold text-primary">{formatCurrency(item.quantity * item.unit_price)}</p>
                </div>
                {item.description && <p className="text-sm text-muted-foreground mt-1">{item.description}</p>}
                <p className="text-xs text-muted-foreground mt-2">
                  {item.quantity} x {formatCurrency(item.unit_price)} por unidade
                </p>
              </div>
            ))}
          </div>

          <Separator className="bg-border" />

          {/* Total Final */}
          <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg border border-primary/30">
            <p className="text-xl font-bold text-foreground">TOTAL ESTIMADO:</p>
            <p className="text-3xl font-extrabold text-primary">{formatCurrency(totalAmount)}</p>
          </div>
        </section>

        {/* Condições e Termos */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Condições e Prazos
          </h2>
          
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-lg text-foreground">Condições de Pagamento:</h3>
                <p className="text-muted-foreground">{proposal.payment_conditions || 'A combinar.'}</p>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground">Termos e Observações:</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{proposal.custom_terms || 'Nenhum termo personalizado adicionado.'}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Portfólio (Mockado) */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
            <Eye className="h-6 w-6 text-primary" /> Nosso Portfólio
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {GAMA_FLOW_INFO.portfolio.map((project, index) => (
              <Card key={index} className="bg-card border-border shadow-sm card-hover-effect overflow-hidden">
                <img src={project.imageUrl} alt={project.title} className="w-full h-48 object-cover" />
                <CardContent className="p-4 space-y-1">
                  <h3 className="font-semibold text-lg text-foreground">{project.title}</h3>
                  <p className="text-sm text-muted-foreground">{project.description}</p>
                  <Button variant="link" size="sm" className="p-0 h-auto text-primary">Ver Projeto Externo</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
        
        {/* Status Final */}
        {isFinalized && (
          <Card className={cn(
            "p-6 text-center border-2",
            proposal.status === 'accepted' ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10"
          )}>
            <h2 className="text-2xl font-bold text-foreground">
              {proposal.status === 'accepted' ? 'PROPOSTA ACEITA!' : isExpired ? 'PROPOSTA EXPIRADA' : 'PROPOSTA REJEITADA'}
            </h2>
            <p className="text-muted-foreground mt-2">
              {proposal.status === 'accepted' ? `Aguarde o contato da nossa equipe. Aceito em: ${format(new Date(proposal.accepted_at!), 'PPP', { locale: ptBR })}.` :
              isExpired ? 'Esta proposta não é mais válida. Por favor, solicite uma atualização.' :
              `Status final: ${PROPOSAL_STATUS_LABELS[proposal.status]}.`}
            </p>
          </Card>
        )}
      </main>

      {/* Barra de Ação Fixa (Mobile e Desktop) */}
      {!isFinalized && (
        <div className="sticky bottom-0 z-30 w-full border-t border-border bg-card shadow-2xl p-4 pb-[calc(1rem+var(--sab))]">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleAccept}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-base font-semibold h-12"
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
              Aceitar Proposta
            </Button>
            <Button 
              onClick={handleReject}
              variant="outline"
              className="flex-1 border-red-500 text-red-500 hover:bg-red-500/10 text-base font-semibold h-12"
              disabled={updateStatusMutation.isPending}
            >
              <XCircle className="mr-2 h-5 w-5" /> Rejeitar Proposta
            </Button>
            <Button 
              onClick={handleDownloadPdf}
              variant="secondary"
              className="flex-1 bg-secondary hover:bg-secondary-hover text-foreground text-base font-semibold h-12"
              disabled={updateStatusMutation.isPending}
            >
              <Download className="mr-2 h-5 w-5" /> Baixar PDF
            </Button>
          </div>
        </div>
      )}
      
      {/* Modal de Rejeição */}
      <Dialog open={isRejectionModalOpen} onOpenChange={setIsRejectionModalOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Rejeitar Proposta</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Por favor, nos diga o motivo da rejeição para que possamos melhorar.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo da rejeição (Opcional)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="min-h-[100px]"
          />
          <Button 
            onClick={handleConfirmReject}
            variant="destructive"
            disabled={updateStatusMutation.isPending}
          >
            {updateStatusMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
            Confirmar Rejeição
          </Button>
        </DialogContent>
      </Dialog>
      
      {/* Modal de WhatsApp (Abre ao aceitar) */}
      <Dialog open={showWhatsAppModal} onOpenChange={setShowWhatsAppModal}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" /> Proposta Aceita!
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Parabéns! Para formalizar o início do projeto, clique no botão abaixo para nos enviar uma mensagem no WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <Button 
            onClick={handleWhatsApp}
            className="w-full bg-green-600 hover:bg-green-700 text-white text-base font-semibold h-12"
          >
            <MessageSquare className="mr-2 h-5 w-5" /> Enviar Mensagem de Confirmação (WhatsApp)
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicProposalPage;