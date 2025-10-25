"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from "@/integrations/supabase/auth";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';

interface ClientProgress {
  client_id: string;
  client_name: string;
  client_logo_url: string | null;
  total_tasks: number;
  completed_tasks: number;
}

const fetchClientProgress = async (userId: string): Promise<ClientProgress[]> => {
  const { data, error } = await supabase.from('clients')
    .select(`
      id, name, logo_url,
      tasks(
        count,
        is_completed,
        status
      )
    `)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  const clientProgress = data?.map(client => {
    const totalTasks = client.tasks.length;
    const completedTasks = client.tasks.filter(task => 
      task.status === 'approved' || task.status === 'posted'
    ).length;

    return {
      client_id: client.id,
      client_name: client.name,
      client_logo_url: client.logo_url,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
    };
  }) || [];

  return clientProgress;
};

const ClientProgressBoard: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: clientProgress, isLoading, error } = useQuery<ClientProgress[], Error>({
    queryKey: ["clientProgress", userId],
    queryFn: () => fetchClientProgress(userId!),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500">Erro ao carregar progresso dos clientes.</p>;
  }

  return (
    <Card className="bg-card border-border shadow-sm card-hover-effect">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-500" /> Progresso por Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {clientProgress && clientProgress.length > 0 ? (
          clientProgress.map(progress => {
            const completionPercentage = progress.total_tasks > 0 ? (progress.completed_tasks / progress.total_tasks) * 100 : 0;

            return (
              <div key={progress.client_id} className="p-3 bg-muted/20 rounded-lg border border-border">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={progress.client_logo_url || undefined} alt={progress.client_name} />
                    <AvatarFallback className="text-xs bg-primary/20 text-primary">{getInitials(progress.client_name)}</AvatarFallback>
                  </Avatar>
                  <p className="font-semibold text-foreground">{progress.client_name}</p>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{progress.completed_tasks}/{progress.total_tasks} concluídas</span>
                  <span>{completionPercentage.toFixed(0)}%</span>
                </div>
                <Progress value={completionPercentage} className="h-2" />
              </div>
            );
          })
        ) : (
          <p className="text-muted-foreground">Nenhum cliente com tarefas encontradas.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientProgressBoard;