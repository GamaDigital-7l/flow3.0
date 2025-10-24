import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Edit, Trash2, Copy, Send, FileText, CalendarDays, Users, DollarSign, CheckCircle2, XCircle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Proposal, ProposalStatus, PROPOSAL_STATUS_LABELS } from '@/types/proposal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import ProposalForm from '@/components/proposal/ProposalForm';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { LinkProps } from 'react-router-dom'; // Assuming LinkProps is needed for PaginationLink

const ITEMS_PER_PAGE = 10;

// ... (fetchProposals function)

const ProposalsPage: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Proposal | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ProposalStatus | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentProposalLink, setCurrentProposalLink] = useState<{ link: string; proposalId: string } | null>(null);

  const { data: proposals, isLoading, error, refetch } = useQuery<Proposal[], Error>({
    queryKey: ["proposals", userId],
    queryFn: () => fetchProposals(userId!),
    enabled: !!userId,
    // Removed Error 45: keepPreviousData is deprecated
  });

  // ... (handleProposalSaved, handleEditProposal, handleDeleteProposal, handleCopyLink, handleSendProposal functions)

  const filteredProposals = useMemo(() => {
    const proposalsArray = proposals || [];
    let filtered: Proposal[] = proposalsArray;

    if (searchTerm) {
      filtered = filtered.filter(proposal => // Fixed Error 46
        proposal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        proposal.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(proposal => proposal.status === selectedStatus); // Fixed Error 47
    }

    return filtered;
  }, [proposals, searchTerm, selectedStatus]);

  const paginatedProposals = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredProposals.slice(startIndex, endIndex);
  }, [filteredProposals, currentPage]);

  const totalPages = Math.ceil((filteredProposals.length || 0) / ITEMS_PER_PAGE); // Fixed Error 48

  // ... (loading and error handling)

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ... (Header and DialogTrigger) */}

      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Buscar propostas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select 
          onValueChange={(value) => setSelectedStatus(value as ProposalStatus | 'all')} // Fixed Error 49: Cast value to union type
          defaultValue="all"
        >
          <SelectTrigger className="w-full sm:w-auto">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filtrar por Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {Object.entries(PROPOSAL_STATUS_LABELS).map(([status, label]) => (
              <SelectItem key={status} value={status}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredProposals && filteredProposals.length > 0 ? ( // Fixed Error 50
          paginatedProposals.map(proposal => { // Fixed Error 51
            const totalAmount = proposal.items?.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) || 0;
            // ... (Card rendering)
          })
        ) : (
          <Card className="p-6 text-center text-muted-foreground">
            Nenhuma proposta encontrada.
          </Card>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationPrevious 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
              disabled={currentPage === 1} 
              // Removed href (Error 52)
            />
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <PaginationItem key={page}> {/* Removed active prop (Error 53) */}
                <PaginationLink to={`?page=${page}`} onClick={() => setCurrentPage(page)} active={currentPage === page}>
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationNext 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
              disabled={currentPage === totalPages} 
              // Removed href (Error 54)
            />
          </PaginationContent>
        </Pagination>
      )}

      {/* Link Dialog */}
      <Dialog open={!!currentProposalLink} onOpenChange={() => setCurrentProposalLink(null)}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle>Link de Acesso Público</DialogTitle>
            <DialogDescription>
              Compartilhe este link para que o cliente possa visualizar e aprovar a proposta.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => handleCopyLink(currentProposalLink?.link || '', 'Link copiado com sucesso!')} // Fixed Error 55: Added success message
              className="w-1/2 mr-2"
            >
              <Copy className="mr-2 h-4 w-4" /> Copiar Link
            </Button>
            {/* ... (Send button) */}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProposalsPage;