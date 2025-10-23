"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { RecurringTask, RecurringHistory, DAYS_OF_WEEK_LABELS } from "@/types/task";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Repeat, Loader2, PlusCircle, CheckCircle2, TrendingUp, CalendarDays, XCircle } from "lucide-react";
import { showError } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import RecurringTaskForm from "@/components/recurring/RecurringTaskForm";
import RecurringTaskItem from "@/components/recurring/RecurringTaskItem";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { Progress } from "@/components/ui/progress";
import { BarChart } from "recharts"; // Importando BarChart para o gráfico
import { sql } from '@supabase/postgrest-js';
import { cn } from "@/lib/utils";

interface TemplateWithMetrics extends RecurringTask {
  history?: RecurringHistory[];
}

const fetchRecurringTemplates = async (userId: string): Promise<TemplateWithMetrics[]> => {
  // Busca apenas os templates (onde recurrence_id == id)
  const { data, error } = await supabase
    .from("recurring_tasks")
    .select(`
      *,
      history:recurring_history(date_local, completed)
    `)
    .eq("user_id", userId)
    .eq('recurrence_id', supabase.rpc('get_recurrence_id', { task_id: sql.column('id') }))
    .order("title", { ascending: true });

  if (error) throw error;

  return data.map(template => ({
    ...template,
    fail_by_weekday: template.fail_by_weekday || {0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0},
  })) as TemplateWithMetrics[];
};

const RecurringTasks: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const { data: templates, isLoading, error, refetch } = useQuery<TemplateWithMetrics[], Error>({
    queryKey: ["recurringTemplates", userId],
    queryFn: () => fetchRecurringTemplates(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando hábitos...
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar hábitos: " + error.message);
    return <p className="text-red-500">Erro ao carregar hábitos: {error.message}</p>;
  }

  const activeTemplates = templates?.filter(t => !t.paused) || [];
  const pausedTemplates = templates?.filter(t => t.paused) || [];

  return (
    <div className="page-content-wrapper space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Repeat className="h-7 w-7 text-orange-500" /> Hábitos Recorrentes
        </h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsFormOpen(true)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Hábito
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">Adicionar Novo Hábito</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Defina uma tarefa que será renovada automaticamente.
              </DialogDescription>
            </DialogHeader>
            <RecurringTaskForm
              onTaskSaved={refetch}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground mb-8">
        Gerencie seus hábitos, acompanhe seu streak e taxa de sucesso.
      </p>

      {/* Templates Ativos */}
      <Card className="mb-8 bg-card border-border shadow-lg frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Hábitos Ativos ({activeTemplates.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeTemplates.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activeTemplates.map(template => (
                <Card key={template.id} className="p-3 border border-border rounded-lg bg-muted/20 space-y-3">
                  <RecurringTaskItem task={template} refetchTasks={refetch} isTemplateView={true} />
                  
                  {/* Métricas e Histórico */}
                  <div className="space-y-3 pt-2 border-t border-border/50">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="space-y-1">
                        <p className="font-medium text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-green-500" /> Total Concluído</p>
                        <p className="text-xl font-bold text-foreground">{template.total_completed}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-muted-foreground flex items-center gap-1"><TrendingUp className="h-4 w-4 text-primary" /> Taxa de Sucesso</p>
                        <p className="text-xl font-bold text-foreground">{template.success_rate.toFixed(1)}%</p>
                        <Progress value={template.success_rate} className="h-2" />
                      </div>
                    </div>
                    
                    {/* Gráfico de Falhas por Dia da Semana */}
                    <div className="space-y-1">
                      <p className="font-medium text-muted-foreground">Dias que Mais Falha</p>
                      <div className="flex justify-between items-end h-16 gap-1">
                        {Object.entries(template.fail_by_weekday).map(([dayIndexStr, count]) => {
                          const dayIndex = parseInt(dayIndexStr);
                          const maxFails = Math.max(...Object.values(template.fail_by_weekday));
                          const height = maxFails > 0 ? (count / maxFails) * 100 : 0;
                          
                          return (
                            <div key={dayIndex} className="flex flex-col items-center justify-end h-full w-full">
                              <div 
                                className="w-3/4 rounded-t-sm bg-red-500/70 transition-all duration-300" 
                                style={{ height: `${height}%` }}
                              />
                              <span className="text-xs text-muted-foreground mt-1">{DAYS_OF_WEEK_LABELS[dayIndex]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Histórico de Conclusão (Mini-Calendário) */}
                    <div className="space-y-1">
                      <p className="font-medium text-muted-foreground">Histórico Recente</p>
                      <div className="flex flex-wrap gap-1">
                        {template.history?.slice(0, 30).map((h, index) => (
                          <div 
                            key={index} 
                            title={h.date_local}
                            className={cn(
                              "h-4 w-4 rounded-sm",
                              h.completed ? "bg-green-500" : "bg-red-500/50"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhum hábito ativo no momento. Adicione um novo!</p>
          )}
        </CardContent>
      </Card>

      {/* Templates Pausados */}
      {pausedTemplates.length > 0 && (
        <Card className="bg-card border-border shadow-lg frosted-glass">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-muted-foreground flex items-center gap-2">
              <XCircle className="h-5 w-5" /> Hábitos Pausados ({pausedTemplates.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pausedTemplates.map(template => (
              <RecurringTaskItem key={template.id} task={template} refetchTasks={refetch} isTemplateView={true} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RecurringTasks;