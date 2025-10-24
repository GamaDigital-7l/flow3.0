"use client";

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import PageTitle from "@/components/layout/PageTitle";
import { useSession } from '@/integrations/supabase/auth'; // Importação adicionada

// Simplified Types
type ClientTaskStatus = "in_progress" | "under_review" | "approved" | "edit_requested" | "posted";
interface ClientTask {
  id: string;
  title: string;
  description: string | null;
  status: ClientTaskStatus;
}
interface Client {
  id: string;
  name: string;
}

const KANBAN_COLUMNS: { id: ClientTaskStatus; title: string; color: string }[] = [
  { id: "in_progress", title: "Em Produção", color: "text-blue-500" },
  { id: "under_review", title: "Para Aprovação", color: "text-yellow-500" },
  { id: "approved", title: "Aprovado", color: "text-green-500" },
  { id: "edit_requested", title: "Edição Solicitada", color: "text-orange-500" },
  { id: "posted", title: "Postado/Concluído", color: "text-purple-500" },
];

const fetchClientData = async (clientId: string, userId: string): Promise<{ client: Client | null, tasks: ClientTask[] }> => {
  const [clientResponse, tasksResponse] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .eq("user_id", userId)
      .single(),
    supabase
      .from("client_tasks")
      .select("id, title, description, status")
      .eq("client_id", clientId)
      .eq("user_id", userId)
  ]);

  if (clientResponse.error) throw clientResponse.error;
  if (tasksResponse.error) throw tasksResponse.error;

  return {
    client: clientResponse.data || null,
    tasks: tasksResponse.data as ClientTask[],
  };
};

const ClientKanban: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["clientTasks", clientId, userId],
    queryFn: () => fetchClientData(clientId!, userId!),
    enabled: !!clientId && !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.client) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold">Error loading client data.</h1>
      </div>
    );
  }

  const { client, tasks } = data;

  return (
    <div className="page-content-wrapper space-y-6">
      <PageTitle title={`Workspace: ${client.name}`} description="Gerencie o fluxo de trabalho e aprovações do cliente.">
        <Button variant="outline" onClick={() => navigate('/clients')}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes</Button>
      </PageTitle>
      <div className="flex overflow-x-auto space-x-4 pb-4 custom-scrollbar">
        {KANBAN_COLUMNS.map(column => (
          <Card key={column.id} className="w-80 flex-shrink-0 bg-secondary/50 border-border shadow-lg">
            <CardHeader className="p-3 pb-2">
              <CardTitle className={cn("text-lg font-semibold", column.color)}>{column.title}</CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 p-3 pt-0">
              <CardContent className="space-y-3">
                {tasks
                  .filter(task => task.status === column.id)
                  .map(task => (
                    <div key={task.id} className="p-2 bg-muted/20 rounded-md border border-border">
                      <p className="text-sm font-semibold">{task.title}</p>
                      {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
                    </div>
                  ))}
              </CardContent>
            </ScrollArea>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ClientKanban;