"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Clock, CheckCircle2, Edit, MessageSquare, User } from 'lucide-react';
import { showError } from '@/utils/toast';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface HistoryEntry {
  id: string;
  client_task_id: string;
  user_id: string | null;
  event_type: string;
  details: {
    client_name?: string;
    task_title?: string;
    month_year_reference?: string;
    edit_reason?: string | null;
  } | null;
  created_at: string;
}

interface ClientTaskHistoryProps {
  clientTaskId: string;
}

const fetchTaskHistory = async (clientTaskId: string, userId: string): Promise<HistoryEntry[]> => {
  const { data, error } = await supabase
    .from("client_task_history")
    .select(`
      id, client_task_id, user_id, event_type, details, created_at
    `)
    .eq("client_task_id", clientTaskId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as HistoryEntry[] || [];
};

const getEventIcon = (eventType: string) => {
  switch (eventType) {
    case 'approved_via_public_link':
      return <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />;
    case 'edit_requested_via_public_link':
      return <Edit className="h-4 w-4 text-orange-500 flex-shrink-0" />;
    case 'rejected_via_public_link':
      return <MessageSquare className="h-4 w-4 text-red-500 flex-shrink-0" />;
    case 'created':
      return <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    case 'updated':
      return <Edit className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    case 'status_changed':
      return <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
  }
};

const getEventDescription = (eventType: string, details: HistoryEntry['details']) => {
  switch (eventType) {
    case 'approved_via_public_link':
      return "Aprovado pelo Cliente via link público.";
    case 'edit_requested_via_public_link':
      return `Edição solicitada pelo Cliente. Motivo: ${details?.edit_reason || 'N/A'}`;
    case 'rejected_via_public_link':
      return `Rejeitado pelo Cliente. Motivo: ${details?.edit_reason || 'N/A'}`;
    case 'created':
      return "Tarefa criada.";
    case 'updated':
      return "Tarefa atualizada.";
    case 'status_changed':
      return "Status alterado.";
    default:
      return `Evento: ${eventType}`;
  }
};

const ClientTaskHistory: React.FC<ClientTaskHistoryProps> = ({ clientTaskId }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: history, isLoading, error } = useQuery<HistoryEntry[], Error>({
    queryKey: ["clientTaskHistory", clientTaskId, userId],
    queryFn: () => fetchTaskHistory(clientTaskId, userId!),
    enabled: !!userId && !!clientTaskId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar histórico: " + error.message);
    return <p className="text-red-500">Erro ao carregar histórico.</p>;
  }

  return (
    <Card className="bg-card border border-border rounded-xl shadow-sm">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" /> Histórico de Ações
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-3">
        {history && history.length > 0 ? (
          history.map(entry => (
            <div key={entry.id} className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg border border-border">
              {getEventIcon(entry.event_type)}
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium break-words", entry.event_type.includes('public_link') ? 'text-foreground' : 'text-muted-foreground')}>
                  {getEventDescription(entry.event_type, entry.details)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDateTime(entry.created_at)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground text-sm">Nenhum histórico encontrado para esta tarefa.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientTaskHistory;