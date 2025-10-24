import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Proposal, ProposalStatus, PROPOSAL_STATUS_LABELS, ProposalItem } from '@/types/proposal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Loader2, FileText, Send, Eye, CheckCircle2, XCircle, Clock, Copy, Link as LinkIcon, Search, SortAsc, SortDesc, Download, CalendarDays } from 'lucide-react';
import { showError, showSuccess, showInfo } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import ProposalForm from '@/components/proposal/ProposalForm';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatCurrency } from '@/lib/utils';
import { format, addDays, isPast } from 'date-fns';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog"

type SortOrder = 'asc' | 'desc';
type SortColumn = 'created_at' | 'updated_at' | 'validity_days' | 'total_amount';

const ITEMS_PER_PAGE = 10;

const fetchProposals = async (userId: string, sortColumn: SortColumn, sortOrder: SortOrder, page: number): Promise<Proposal[]> => {
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  let query = supabase
    .from("proposals")
    .select(`
      *,
      client:clients(id, name),
      items:proposal_items(*)
    `, { count: 'estimated' })
    .eq("user_id", userId);

  if (sortColumn === 'total_amount') {
    // Ordenar por valor total requer calcular o valor total no lado do cliente
  } else {
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' });
  }

  query = query.range(startIndex, startIndex + ITEMS_PER_PAGE - 1);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  let proposals = data || [];

  if (sortColumn === 'total_amount') {
    proposals = proposals.sort((a, b) => {
      const totalA = a.items?.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) || 0;
      const totalB = b.items?.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) || 0;
      return sortOrder === 'asc' ? totalA - totalB : totalB - totalA;
    });
  }

  return proposals;
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

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Proposal | undefined>(undefined);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [currentProposalLink, setCurrentProposalLink] = useState<{ link: string; clientName: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ProposalStatus | 'all'>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewProposal, setViewProposal] = useState<Proposal | null>(null);
  const [proposalToDelete, setProposalToDelete] = useState<Proposal | null>(null);

  const { data: proposals, isLoading, error, refetch } = useQuery<Proposal[], Error>({
    queryKey: ["proposals", userId, sortColumn, sortOrder, currentPage],
    queryFn: () => fetchProposals(userId!, sortColumn, sortOrder, currentPage),
    enabled: !!userId,
    keepPreviousData: true,
  });

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
  
  const handleGenerateLink = async (proposal: Proposal) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('generate-approval-link', {
        body: {
          clientId: proposal.client_id,
          monthYearRef: format(new Date(), "yyyy-MM"),
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error("Erro ao gerar link de aprovação:", error);
        showError("Erro ao gerar link de aprovação: " + error.message);
        return;
      }

      const publicLink = `${window.location.origin}/proposal/${data.uniqueId}`;
      setCurrentProposalLink({ link: publicLink, clientName: proposal.client_name });
      setIsLinkModalOpen(true);

      // Atualiza o status para 'sent' se for 'draft'
      if (proposal.status === 'draft') {
        supabase.from('proposals').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', proposal.id).then(({ error }) => {
          if (error) console.error("Erro ao atualizar status para 'sent':", error);
          else refetch();
        });
      }
    } catch (err: any) {
      showError("Erro ao gerar link: " + err.message);
    }
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

  const filteredProposals = React.useMemo(() => {
    let filtered = proposals || [];

    if (searchTerm) {
      filtered = filtered.filter(proposal =>
        proposal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        proposal.client_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(proposal => proposal.status === selectedStatus);
    }

    return filtered;
  }, [proposals, searchTerm, selectedStatus]);

  const totalPages = Math.ceil((proposals?.length || 0) / ITEMS_PER_PAGE);

  return (
    <div className="page-content-wrapper space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-7 w-7 text-primary" /> Orçamentos Profissionais
        </h1>
        <div className="flex gap-2">
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingProposal(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Nova Proposta
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">{editingProposal ? "Editar Proposta" : "Criar Nova Proposta"}</DialogTitle>
                <DialogDescription>
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
          <Button variant="outline" onClick={() => {}} className="text-blue-500 hover:bg-blue-500/10">
            <Download className="mr-2 h-4 w-4" /> Exportar para CSV
          </Button>
        </div>
      </div>
      <p className="text-lg text-muted-foreground">
        Crie, envie e rastreie o status dos seus orçamentos.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por título ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-input border-border text-foreground focus-visible:ring-ring"
          />
        </div>
        <Select onValueChange={setSelectedStatus} defaultValue="all">
          <SelectTrigger className="w-full sm:w-auto">
            <SelectValue placeholder="Filtrar por Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="sent">Enviado</SelectItem>
            <SelectItem value="viewed">Visualizado</SelectItem>
            <SelectItem value="accepted">Aceito</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
        <Select onValueChange={(value) => {
          const [column, order] = value.split(':') as [SortColumn, SortOrder];
          setSortColumn(column);
          setSortOrder(order);
        }} defaultValue="created_at:desc">
          <SelectTrigger className="w-full sm:w-auto">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at:asc">Data de Criação (Mais Antiga)</SelectItem>
            <SelectItem value="created_at:desc">Data de Criação (Mais Recente)</SelectItem>
            <SelectItem value="updated_at:asc">Data de Modificação (Mais Antiga)</SelectItem>
            <SelectItem value="updated_at:desc">Data de Modificação (Mais Recente)</SelectItem>
            <SelectItem value="validity_days:asc">Validade (Menor)</SelectItem>
            <SelectItem value="validity_days:desc">Validade (Maior)</SelectItem>
            <SelectItem value="total_amount:asc">Valor Total (Menor)</SelectItem>
            <SelectItem value="total_amount:desc">Valor Total (Maior)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredProposals && filteredProposals.length > 0 ? (
          filteredProposals.map(proposal => {
            const totalAmount = proposal.items?.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) || 0;
            return (
              <Tooltip key={proposal.id} delayDuration={200}>
                <TooltipTrigger asChild>
                  <Card className="bg-card border border-border rounded-xl shadow-sm card-hover-effect cursor-pointer">
                    <Link to={`/proposal/${proposal.unique_link_id}`} className="block">
                      <CardContent className="p-4 flex justify-between items-center gap-4 flex-wrap">
                        <div className="min-w-0 flex-1 space-y-1">
                          <h3 className="font-bold text-lg text-foreground truncate">{proposal.title}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" /> {proposal.client_name} ({proposal.client_company || 'N/A'})
                          </p>
                          <p className="text-sm text-primary font-semibold">{formatCurrency(totalAmount)}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {getStatusBadge(proposal.status, proposal.validity_days, proposal.created_at)}
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Validade: {format(addDays(new Date(proposal.created_at), proposal.validity_days), "dd/MM/yyyy")}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" /> Criado em: {formatDateTime(proposal.created_at, false)}
                            </p>
                            {proposal.viewed_at && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Eye className="h-3 w-3" /> Visto em: {formatDateTime(proposal.viewed_at, false)}
                              </p>
                            )}
                            {proposal.status === 'edit_requested' && (
                              <Badge variant="outline" className="text-yellow-500 bg-yellow-500/10 border-yellow-500">
                                Edição Solicitada
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); handleGenerateLink(proposal); }} className="h-8 w-8 text-green-500 hover:bg-green-500/10">
                            <Send className="h-4 w-4" />
                            <span className="sr-only">Enviar Link</span>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); handleEditProposal(proposal); }} className="h-8 w-8 text-blue-500 hover:bg-blue-500/10">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-500/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação irá deletar a proposta permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteProposal.mutate(proposal.id)}>Deletar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Link da Proposta: {`${window.location.origin}/proposal/${proposal.unique_link_id}`}</p>
                </TooltipContent>
              </Tooltip>
            );
          })
        ) : (
          <p className="text-muted-foreground">Nenhuma proposta encontrada. Crie sua primeira proposta!</p>
        )}
      </div>

      <div className="flex w-full justify-center">
        <Pagination>
          <PaginationContent>
            <PaginationPrevious href="?previous" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} />
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <PaginationItem key={page} active={currentPage === page}>
                <PaginationLink href={`?page=${page}`} onClick={() => setCurrentPage(page)} isCurrent={currentPage === page}>
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationNext href="?next" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} />
          </PaginationContent>
        </Pagination>
      </div>

      {/* Modal para exibir o link */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Link da Proposta</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Compartilhe este link com o cliente para que ele possa visualizar a proposta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={currentProposalLink?.link} readOnly className="bg-input border-border text-foreground focus-visible:ring-ring" />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => handleCopyLink(currentProposalLink?.link || '')} className="w-1/2 mr-2">
                <Copy className="mr-2 h-4 w-4" /> Copiar Link
              </Button>
              <Button onClick={() => handleCopyLink(currentProposalLink?.link || '', true)} className="w-1/2 bg-green-500 text-white hover:bg-green-700">
                <Send className="mr-2 h-4 w-4" /> WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Proposals;