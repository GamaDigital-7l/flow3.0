"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Task } from "@/types/task";
import { CheckCircle2, XCircle, Loader2, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RecurringTemplateHistoryProps {
  templateId: string;
}

const fetchTemplateInstances = async (userId: string, templateId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, due_date, is_completed, completed_at
    `)
    .eq("user_id", userId)
    .eq("parent_task_id", templateId)
    .order("due_date", { ascending: false })
    .limit(30); // Limita a 30 instâncias recentes

  if (error) throw error;
  return data as Task[] || [];
};

const RecurringTemplateHistory: React.FC<RecurringTemplateHistoryProps> = ({ templateId }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: instances, isLoading, error } = useQuery<Task[], Error>({
    queryKey: ["templateInstances", templateId, userId],
    queryFn: () => fetchTemplateInstances(userId!, templateId),
    enabled: !!userId,
  });

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  }

  if (error) {
    return <p className="text-xs text-red-500">Erro ao carregar histórico.</p>;
  }

  const completedCount = instances?.filter(i => i.is_completed).length || 0;
  const totalCount = instances?.length || 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm font-semibold text-foreground">
        <span>Histórico Recente:</span>
        <span className={cn(completedCount > 0 ? "text-green-500" : "text-muted-foreground")}>
          {completedCount} / {totalCount} Concluídas
        </span>
      </div>
      <ScrollArea className="h-[150px] w-full rounded-md border border-border p-2 bg-muted/10">
        <div className="space-y-1">
          {instances && instances.length > 0 ? (
            instances.map(instance => (
              <div key={instance.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  {instance.due_date ? format(new Date(instance.due_date), "dd/MM/yyyy", { locale: ptBR }) : 'N/A'}
                </span>
                {instance.is_completed ? (
                  <span className="flex items-center gap-1 text-green-500 font-medium">
                    <CheckCircle2 className="h-3 w-3" /> Concluída
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-500">
                    <XCircle className="h-3 w-3" /> Pendente
                  </span>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Nenhuma instância gerada ainda.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default RecurringTemplateHistory;