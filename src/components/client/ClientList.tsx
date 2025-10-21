import React from 'react';
import { Client } from '@/types/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Mail, Phone, Building, Users } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showSuccess, showError } from '@/utils/toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';

interface ClientListProps {
  clients: Client[];
  onEdit: (client: Client) => void;
}

const ClientList: React.FC<ClientListProps> = ({ clients, onEdit }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId)
        .eq('user_id', userId);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      showSuccess('Cliente excluído com sucesso!');
    },
    onError: (err) => {
      showError('Erro ao excluir cliente: ' + err.message);
    },
  });

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
        <Card key={client.id} className="flex flex-col justify-between card-hover-effect">
          <CardHeader className="flex flex-row items-center space-x-4 p-4 pb-2">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {getInitials(client.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-lg truncate">{client.name}</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {client.company || 'Cliente Individual'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-2 text-sm">
            <div className="flex items-center text-muted-foreground">
              <Mail className="h-4 w-4 mr-2" />
              <span className="truncate">{client.email}</span>
            </div>
            {client.phone && (
              <div className="flex items-center text-muted-foreground">
                <Phone className="h-4 w-4 mr-2" />
                <span>{client.phone}</span>
              </div>
            )}
            {client.company && (
              <div className="flex items-center text-muted-foreground">
                <Building className="h-4 w-4 mr-2" />
                <span>{client.company}</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2 p-4 pt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(client)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteMutation.mutate(client.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};

export default ClientList;