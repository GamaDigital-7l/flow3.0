import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Search } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from "@/integrations/supabase/auth";
import ClientList from '@/components/client/ClientList';
import ClientFormDialog from '@/components/client/ClientFormDialog';
import { Client } from '@/types/client'; // Importando o tipo Client
import { showError } from '@/utils/toast'; // Importando showError

const ClientsPage: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: clients, isLoading, error } = useQuery<Client[]>({
    queryKey: ['clients', userId, searchTerm],
    queryFn: async () => {
      if (!userId) return [];
      
      // Listando explicitamente as colunas, removendo 'company'
      let query = supabase
        .from('clients')
        .select('id, user_id, name, logo_url, description, color, type, monthly_delivery_goal, contact_email, contact_phone, created_at, updated_at')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) {
        // Logando o erro detalhado para depuração
        console.error("Supabase Fetch Error (Clients):", error);
        throw new Error(error.message);
      }
      return data as Client[];
    },
    enabled: !!userId,
  });

  const handleNewClient = () => {
    setEditingClient(null);
    setIsDialogOpen(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingClient(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    // Exibir o erro no toast para o usuário
    showError("Erro ao carregar clientes: " + error.message);
    return <div className="text-destructive">Erro ao carregar clientes: {error.message}</div>;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Clientes</h1>
        <div className="flex gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <ClientFormDialog
            isOpen={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            initialData={editingClient}
            onClientSaved={() => {
              queryClient.invalidateQueries({ queryKey: ['clients'] });
              handleCloseDialog();
            }}
          >
            <Button onClick={handleNewClient} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <PlusCircle className="mr-2 h-4 w-4" /> Novo Cliente
            </Button>
          </ClientFormDialog>
        </div>
      </div>

      <ClientList clients={clients || []} onEdit={handleEditClient} />
    </div>
  );
};

export default ClientsPage;