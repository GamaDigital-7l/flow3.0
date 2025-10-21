import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Target, Loader2 } from "lucide-react";
import { Client } from "@/types/client";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { format } from "date-fns";

interface ClientProgress {
  goal: number;
  completed: number;
  percentage: number;
}

const fetchClientProgress = async (clientId: string, userId: string): Promise<ClientProgress> => {
  const today = new Date();
  const monthYearRef = format(today, "yyyy-MM");

  // 1. Buscar a meta do cliente
  const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .select('monthly_delivery_goal')
    .eq('id', clientId)
    .eq('user_id', userId)
    .single();

  if (clientError && clientError.code !== 'PGRST116') throw clientError;
  const goal = clientData?.monthly_delivery_goal || 0;

  if (goal === 0) {
    return { goal: 0, completed: 0, percentage: 0 };
  }

  // 2. Contar tarefas concluídas (status 'approved' ou 'posted') para o mês atual
  const { data: tasksData, error: tasksError } = await supabase
    .from('client_tasks')
    .select('id')
    .eq('client_id', clientId)
    .eq('user_id', userId)
    .eq('month_year_reference', monthYearRef)
    .in('status', ['approved', 'posted', 'completed']); // Contar como concluída se aprovada ou postada

  if (tasksError) throw tasksError;

  const completed = tasksData?.length || 0;
  const percentage = goal > 0 ? Math.min(100, (completed / goal) * 100) : 0;

  return { goal, completed, percentage };
};

interface ClientCardProps {
  client: Client;
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => void;
}

const ClientCard: React.FC<ClientCardProps> = ({ client, onEdit, onDelete }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: progress, isLoading: isLoadingProgress } = useQuery<ClientProgress, Error>({
    queryKey: ["clientProgress", client.id, userId],
    queryFn: () => fetchClientProgress(client.id, userId!),
    enabled: !!userId && client.type === 'fixed', // Apenas clientes fixos têm meta
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const currentProgress = progress || { goal: client.monthly_delivery_goal || 0, completed: 0, percentage: 0 };
  const isGoalMet = currentProgress.completed >= currentProgress.goal && currentProgress.goal > 0;

  return (
    <Card className="flex flex-col h-full bg-card border border-border rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200 frosted-glass card-hover-effect">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src={client.logo_url || undefined} alt={client.name} />
            <AvatarFallback>{client.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <CardTitle className="text-base font-semibold text-foreground break-words min-w-0 line-clamp-1">{client.name}</CardTitle>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 mt-0">
          <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(client); }} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
            <Edit className="h-4 w-4" />
            <span className="sr-only">Editar Cliente</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(client.id); }} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Deletar Cliente</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between p-3 pt-0">
        {client.description && (
          <CardDescription className="text-xs text-muted-foreground mb-2 break-words line-clamp-2">{client.description}</CardDescription>
        )}
        
        {client.type === 'fixed' && (
          <div className="mt-2 space-y-1">
            {isLoadingProgress ? (
              <div className="flex items-center justify-center h-10">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Target className="h-3 w-3 text-primary" /> Meta Mensal: {currentProgress.goal} entregas
                  </p>
                  <p className={cn("text-xs font-semibold", isGoalMet ? "text-green-500" : "text-foreground")}>
                    {currentProgress.completed}/{currentProgress.goal}
                  </p>
                </div>
                <Progress value={currentProgress.percentage} className="h-1.5" indicatorClassName={isGoalMet ? "bg-green-500" : "bg-primary"} />
                <p className="text-xs text-muted-foreground text-right">{currentProgress.percentage.toFixed(0)}% concluído</p>
              </>
            )}
          </div>
        )}
        {client.type !== 'fixed' && (
          <p className="text-xs text-muted-foreground mt-2">Tipo: {client.type.charAt(0).toUpperCase() + client.type.slice(1)}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientCard;