// src/components/client/ClientKanbanHeader.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from 'lucide-react';
import PageTitle from "@/components/layout/PageTitle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from '@/lib/utils';
import { Client } from '@/types/client';

interface ClientKanbanHeaderProps {
  client: Client | null | undefined;
}

const ClientKanbanHeader: React.FC<ClientKanbanHeaderProps> = ({ client }) => {
  const navigate = useNavigate();

  return (
    <PageTitle title={`Workspace: ${client?.name || 'Carregando...'}`} description="Gerencie o fluxo de trabalho e aprovações do cliente.">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={client?.logo_url || undefined} alt={client?.name} />
          <AvatarFallback className="text-xs bg-primary/20 text-primary">{getInitials(client?.name || 'Cliente')}</AvatarFallback>
        </Avatar>
        <Button variant="outline" onClick={() => navigate('/clients')}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
      </div>
    </PageTitle>
  );
};

export default ClientKanbanHeader;