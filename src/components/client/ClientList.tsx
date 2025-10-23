import React from 'react';
// import { Client } from '@/types/client'; // Removido
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Mail, Phone, Building, Users } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from "@/integrations/supabase/auth";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
// import ClientCard from './ClientCard'; // Removido
import { Link } from 'react-router-dom';

// Tipo simplificado para Client
interface Client {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

// Componente ClientCard simplificado para evitar erro de módulo
const ClientCard: React.FC<{ client: Client; onEdit: (client: Client) => void; onDelete: (clientId: string) => void }> = ({ client, onEdit, onDelete }) => (
  <Card className="flex flex-col h-full bg-card border border-border rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200 frosted-glass card-hover-effect">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={client.logo_url || undefined} alt={client.name} />
          <AvatarFallback className="text-sm bg-primary/20 text-primary">{getInitials(client.name)}</AvatarFallback>
        </Avatar>
        <CardTitle className="text-lg line-clamp-1 text-foreground">{client.name}</CardTitle>
      </div>
    </CardHeader>
    <CardContent className="flex-grow space-y-2 text-sm text-muted-foreground">
      <p className="line-clamp-2">{client.description || 'Sem descrição.'}</p>
      {client.contact_email && (
        <p className="flex items-center gap-1">
          <Mail className="h-3 w-3" /> {client.contact_email}
        </p>
      )}
      {client.contact_phone && (
        <p className="flex items-center gap-1">
          <Phone className="h-3 w-3" /> {client.contact_phone}
        </p>
      )}
    </CardContent>
    <CardFooter className="flex justify-end gap-2 pt-4">
      <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); onEdit(client); }} className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-foreground">
        <Edit className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); onDelete(client.id); }} className="h-8 w-8 text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
        <Trash2 className="h-4 w-4" />
      </Button>
    </CardFooter>
  </Card>
);


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
      <div className="text-center text-muted-foreground p-12 border border-dashed rounded-xl bg-card">
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