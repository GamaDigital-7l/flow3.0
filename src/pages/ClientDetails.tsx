"use client";

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSession } from "@/integrations/supabase/auth";
import { Client } from '@/types/client';
import ClientKanbanBoard from '@/components/client/ClientKanbanBoard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import PageTitle from '@/components/layout/PageTitle';

const fetchClientById = async (clientId: string): Promise<Client | null> => {
  const { data, error } = await supabase
    .from("clients")
    .select("id, user_id, name, logo_url, description, color, type, monthly_delivery_goal, contact_email, contact_phone, created_at, updated_at")
    .eq("id", clientId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data || null;
};

const ClientDetails: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();

  const { data: client, isLoading, error } = useQuery<Client | null, Error>({
    queryKey: ["client", clientId],
    queryFn: () => fetchClientById(clientId!),
    enabled: !!clientId,
  });

  if (!clientId) {
    return (
      <div className="p-4">
        <PageTitle title="Cliente Não Encontrado" description="O ID do cliente não foi fornecido." />
        <Button onClick={() => navigate("/clients")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <PageTitle title="Carregando Cliente..." />
      </div>
    );
  }

  if (error || !client) {
    showError("Erro ao carregar cliente: " + error?.message);
    return (
      <div className="p-4">
        <PageTitle title="Erro ao Carregar Cliente" description={error?.message || "O cliente não foi encontrado."} />
        <Button onClick={() => navigate("/clients")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <PageTitle title={client.name}>
        <Button onClick={() => navigate("/clients")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes
        </Button>
      </PageTitle>

      {/* Informações do Cliente */}
      <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" />
            <p className="text-muted-foreground">Tipo: {client.type.charAt(0).toUpperCase() + client.type.slice(1)}</p>
          </div>
          {client.contact_email && (
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground truncate">{client.contact_email}</p>
            </div>
          )}
          {client.contact_phone && (
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground">{client.contact_phone}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kanban */}
      <ClientKanbanBoard monthYearRef={format(new Date(), "yyyy-MM", { locale: ptBR })} />
    </div>
  );
};

export default ClientDetails;