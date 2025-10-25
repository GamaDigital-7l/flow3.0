"use client";

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Search, Users } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import ClientList from '@/components/client/ClientList';
import ClientForm from '@/components/client/ClientForm';
import { Input } from '@/components/ui/input';
import PageTitle from '@/components/layout/PageTitle';
import PageWrapper from '@/components/layout/PageWrapper'; // Import PageWrapper

// Tipo simplificado para Client (deve ser consistente com ClientList.tsx)
interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  monthly_delivery_goal: number;
}

const fetchClients = async (userId: string): Promise<Client[]> => {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
};

const Clients: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: clients, isLoading, error, refetch } = useQuery<Client[], Error>({
    queryKey: ["clients", userId],
    queryFn: () => fetchClients(userId!),
    enabled: !!userId,
  });

  const handleClientSaved = () => {
    refetch();
    setIsFormOpen(false);
    setEditingClient(undefined);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsFormOpen(true);
  };

  const handleDeleteClient = useMutation({
    mutationFn: async (clientId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      
      // Deletar tarefas e tags associadas (ON DELETE CASCADE deve cuidar disso, mas é bom garantir)
      await supabase.from("client_tasks").delete().eq("client_id", clientId);
      
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Cliente deletado com sucesso!");
      refetch();
    },
    onError: (err: any) => {
      showError("Erro ao deletar cliente: " + err.message);
    },
  });

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    return clients.filter(client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clients, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando clientes...
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar clientes: " + error.message);
    return <p className="text-red-500">Erro ao carregar clientes.</p>;
  }

  return (
    <PageWrapper className="space-y-6">
      <PageTitle title="Clientes & Workspaces" description="Gerencie seus clientes e seus quadros de tarefas/posts.">
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingClient(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Novo Cliente (Workspace)
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingClient ? "Editar Cliente" : "Adicionar Novo Cliente"}</DialogTitle>
              <DialogDescription>
                {editingClient ? "Atualize as informações do cliente." : "Crie um novo workspace para gerenciar as tarefas de um cliente."}
              </DialogDescription>
            </DialogHeader>
            <ClientForm
              initialData={editingClient}
              onClientSaved={handleClientSaved}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </PageTitle>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>

      <ClientList
        clients={filteredClients}
        onEdit={handleEditClient}
        onDelete={(id) => {
          if (window.confirm("Tem certeza que deseja deletar este cliente e todas as suas tarefas?")) {
            handleDeleteClient.mutate(id);
          }
        }}
      />
    </PageWrapper>
  );
};

export default Clients;