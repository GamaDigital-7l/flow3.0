import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { isToday, differenceInDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, CalendarIcon, CheckCircle2, Hourglass, PlayCircle, TrendingDown, TrendingUp, Scale, Dumbbell, Loader2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import HealthGoalForm, { GoalFormValues } from "@/components/HealthGoalForm";
import HealthMetricForm, { HealthMetricFormValues } from "@/components/HealthMetricForm";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { parseISO } from "@/lib/utils";

interface Goal extends Omit<GoalFormValues, 'target_date'> {
  id: string;
  target_date: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
}

interface Metric extends Omit<HealthMetricFormValues, 'date'> {
  id: string;
  date: string;
  created_at: string;
}

const fetchGoals = async (userId: string): Promise<Goal[]> => {
  const { data, error } = await supabase
    .from("health_goals")
    .select("*")
    .eq("user_id", userId)
    .order("target_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as Goal[] || [];
};

const fetchMetrics = async (userId: string): Promise<Metric[]> => {
  const { data, error } = await supabase
    .from("health_metrics")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data as Metric[] || [];
};

const Health: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  
  // Placeholder for latestWeight
  const latestWeight = 70; 

  const { data: goals, isLoading: isLoadingGoals, error: errorGoals, refetch: refetchGoals } = useQuery<Goal[], Error>({
    queryKey: ["healthGoals", userId],
    queryFn: () => fetchGoals(userId!),
    enabled: !!userId,
  });

  const { data: metrics, isLoading: isLoadingMetrics, error: errorMetrics, refetch: refetchMetrics } = useQuery<Metric[], Error>({
    queryKey: ["healthMetrics", userId],
    queryFn: () => fetchMetrics(userId!),
    enabled: !!userId,
  });

  const [isGoalFormOpen, setIsGoalFormOpen] = React.useState(false);
  const [editingGoal, setEditingGoal] = React.useState<Goal | undefined>(undefined);
  const [isMetricFormOpen, setIsMetricFormOpen] = React.useState(false);
  const [editingMetric, setEditingMetric] = React.useState<Metric | undefined>(undefined);

  const handleGoalSaved = () => {
    refetchGoals();
    setIsGoalFormOpen(false);
    setEditingGoal(undefined);
  };

  const handleMetricSaved = () => {
    refetchMetrics();
    setIsMetricFormOpen(false);
    setEditingMetric(undefined);
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setIsGoalFormOpen(true);
  };

  const handleEditMetric = (metric: Metric) => {
    setEditingMetric(metric);
    setIsMetricFormOpen(true);
  };

  const handleDeleteGoal = useMutation({
    mutationFn: async (goalId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("health_goals")
        .delete()
        .eq("id", goalId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Meta de saúde deletada com sucesso!");
      refetchGoals();
    },
    onError: (err: any) => {
      showError("Erro ao deletar meta: " + err.message);
    },
  });

  const handleDeleteMetric = useMutation({
    mutationFn: async (metricId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("health_metrics")
        .delete()
        .eq("id", metricId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Métrica deletada com sucesso!");
      refetchMetrics();
    },
    onError: (err: any) => {
      showError("Erro ao deletar métrica: " + err.message);
    },
  });

  if (isLoadingGoals || isLoadingMetrics) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando saúde...
      </div>
    );
  }

  if (errorGoals || errorMetrics) {
    showError("Erro ao carregar dados de saúde: " + (errorGoals || errorMetrics)?.message);
    return <p className="text-red-500">Erro ao carregar dados de saúde.</p>;
  }

  const latestWeightMetric = metrics?.find(m => m.weight_kg !== null);
  const currentWeight = latestWeightMetric?.weight_kg || latestWeight;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Dumbbell className="h-7 w-7 text-primary" /> Saúde e Bem-Estar
        </h1>
        <div className="flex gap-2">
          <Dialog
            open={isMetricFormOpen}
            onOpenChange={(open) => {
              setIsMetricFormOpen(open);
              if (!open) setEditingMetric(undefined);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setEditingMetric(undefined)} variant="outline" className="w-full sm:w-auto border-primary text-primary hover:bg-primary/10">
                <Scale className="mr-2 h-4 w-4" /> Registrar Métrica
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">{editingMetric ? "Editar Métrica" : "Registrar Nova Métrica"}</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {editingMetric ? "Atualize os detalhes da sua métrica." : "Registre seu peso, humor ou outras métricas de saúde."}
                </DialogDescription>
              </DialogHeader>
              <HealthMetricForm
                initialData={editingMetric ? { ...editingMetric, date: parseISO(editingMetric.date) } as any : undefined}
                onMetricSaved={handleMetricSaved}
                onClose={() => setIsMetricFormOpen(false)}
              />
            </DialogContent>
          </Dialog>

          <Dialog
            open={isGoalFormOpen}
            onOpenChange={(open) => {
              setIsGoalFormOpen(open);
              if (!open) setEditingGoal(undefined);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setEditingGoal(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Meta
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">{editingGoal ? "Editar Meta" : "Adicionar Nova Meta de Saúde"}</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {editingGoal ? "Atualize os detalhes da sua meta de saúde." : "Defina uma nova meta para seu bem-estar."}
                </DialogDescription>
              </DialogHeader>
              <HealthGoalForm
                initialData={editingGoal ? { ...editingGoal, target_date: editingGoal.target_date ? parseISO(editingGoal.target_date) : undefined } as any : undefined}
                onGoalSaved={handleGoalSaved}
                onClose={() => setIsGoalFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <p className="text-lg text-muted-foreground mb-8">
        Acompanhe seu peso, metas de fitness e bem-estar geral.
      </p>

      {/* Resumo de Peso */}
      <Card className="mb-8 bg-card border-border shadow-lg frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Scale className="h-5 w-5 text-blue-500" /> Peso Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <p className="text-lg font-medium text-muted-foreground">Última Medição ({latestWeightMetric ? format(parseISO(latestWeightMetric.date), "PPP", { locale: ptBR }) : 'N/A'}):</p>
            <p className="text-2xl font-bold text-blue-500">{currentWeight} kg</p>
          </div>
        </CardContent>
      </Card>

      {/* Metas Ativas */}
      <Card className="mb-8 bg-card border-border shadow-lg frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Metas de Saúde Ativas ({goals?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {goals && goals.length > 0 ? (
            goals.map(goal => {
              const targetDate = goal.target_date ? parseISO(goal.target_date) : null;
              const daysRemaining = targetDate ? differenceInDays(targetDate, new Date()) : null;
              const progress = (goal.current_value / goal.target_value) * 100;

              return (
                <div key={goal.id} className="p-4 border border-border rounded-lg bg-muted/20 space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg text-foreground">{goal.title}</h3>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditGoal(goal)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteGoal.mutate(goal.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{goal.description}</p>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm font-medium">
                      <Label>Progresso: {goal.current_value} / {goal.target_value} {goal.unit}</Label>
                      <Label>{progress.toFixed(0)}%</Label>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                    {targetDate && (
                      <p className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" /> Prazo: {format(targetDate, "PPP", { locale: ptBR })}
                      </p>
                    )}
                    {daysRemaining !== null && (
                      <p className="flex items-center gap-1">
                        <Hourglass className="h-3 w-3" /> {daysRemaining >= 0 ? `${daysRemaining} dias restantes` : `${Math.abs(daysRemaining)} dias atrasado`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-muted-foreground">Nenhuma meta de saúde ativa no momento. Adicione uma nova meta!</p>
          )}
        </CardContent>
      </Card>

      {/* Últimas Métricas */}
      <Card className="bg-card border-border shadow-lg frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Últimas Métricas ({metrics?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {metrics && metrics.length > 0 ? (
            metrics.map(metric => (
              <div key={metric.id} className="p-3 border border-border rounded-lg bg-muted/20 space-y-1">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-foreground">
                    {metric.weight_kg !== null ? `${metric.weight_kg} kg` : 'Métrica Registrada'}
                  </h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEditMetric(metric)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteMetric.mutate(metric.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" /> {format(parseISO(metric.date), "PPP", { locale: ptBR })}
                </p>
                {metric.notes && (
                  <p className="text-xs text-muted-foreground mt-2 border-t pt-1 line-clamp-2">{metric.notes}</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Nenhuma métrica de saúde registrada.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Health;