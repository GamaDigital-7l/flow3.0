import React from 'react';
import { Client } from '@/types/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Mail, Phone, Building, Users } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from "@/integrations/supabase/auth";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import ClientCard from './ClientCard'; // Importar o ClientCard atualizado
import { Link } from 'react-router-dom';

interface ClientListProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => void;
}

const ClientList: React.FC<ClientListProps> = ({ clients, onEdit, onDelete }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  if (clients.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-12 border border-dashed rounded-lg bg-card">
        <Users className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-semibold">Nenhum cliente encontrado.</p>
        <p>Comece adicionando seu primeiro cliente para organizar seus projetos.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {clients.map((client) => (
        <Link key={client.id} to={`/clients/${client.id}`} className="block">
          <ClientCard 
            client={client} 
            onEdit={onEdit} 
            onDelete={onDelete} 
          />
        </Link>
      ))}
    </div>
  );
};

export default ClientList;